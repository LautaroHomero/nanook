import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notification.service';
import {
  MercadoPagoProvider,
  MockMercadoPagoProvider,
  PaymentProvider,
  PaymentStatusResult,
  PendingOrderPayload,
} from './payment.provider';

export interface CreateCheckoutInput {
  title: string;
  amount: number;
  buyerEmail: string;
  orderPayload: PendingOrderPayload;
}

// Forma mínima que necesitan resolveReturn/getPaymentStatus, común a la orden
// recién creada (finalizeApprovedPayment) y a una ya existente encontrada por
// idempotencia (findExistingByPaymentId) — sus `include` de Prisma no son
// idénticos, pero ambos cubren estos campos.
interface ExistingOrder {
  id: string;
  orderNumber: number;
  status: string;
  total: unknown;
  payment: { preferenceId: string | null; status: string } | null;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private provider: PaymentProvider;
  private readonly mockMode: boolean;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {
    this.mockMode = process.env.MP_MOCK === 'true' || !process.env.MP_ACCESS_TOKEN;

    this.provider = this.mockMode
      ? new MockMercadoPagoProvider()
      : new MercadoPagoProvider(process.env.MP_ACCESS_TOKEN);
  }

  isMockMode() {
    return this.mockMode;
  }

  // Solo para la pantalla de "pago simulado" (ver PaymentsController): toma
  // el payload que quedó guardado en el mock provider al crear la preferencia
  // y lo finaliza como si MP hubiera aprobado el pago.
  async confirmMockPayment(externalReference: string) {
    if (!this.mockMode || !(this.provider instanceof MockMercadoPagoProvider)) {
      throw new Error('El pago simulado está deshabilitado en este entorno');
    }
    const pending = this.provider.consumePending(externalReference);
    if (!pending) {
      throw new Error(`No hay un checkout simulado pendiente para ${externalReference}`);
    }
    const fakePaymentId = Math.floor(Date.now() / 1000);
    const finalized = await this.finalizeApprovedPayment(
      pending.payload,
      fakePaymentId,
      pending.preferenceId,
    );
    return finalized.order;
  }

  // La orden todavía no existe en nuestra base: se arma la preferencia de MP
  // con todos los datos necesarios para reconstruirla más tarde (ver
  // PendingOrderPayload) y no se escribe nada hasta que el pago se apruebe.
  async createCheckout(input: CreateCheckoutInput) {
    const externalReference = randomUUID();
    const result = await this.provider.createPreference({
      externalReference,
      title: input.title,
      amount: input.amount,
      buyerEmail: input.buyerEmail,
      orderPayload: input.orderPayload,
    });
    return { ...result, externalReference };
  }

  validateWebhookSignature(input: {
    xSignature?: string | null;
    xRequestId?: string | null;
    dataId?: string | null;
  }) {
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (!secret) {
      throw new Error('Falta MP_WEBHOOK_SECRET para validar webhooks de Mercado Pago');
    }

    const xSignature = input.xSignature?.trim();
    const xRequestId = input.xRequestId?.trim();
    const dataId = input.dataId?.trim();

    if (!xSignature || !xRequestId || !dataId) {
      return { valid: false, reason: 'missing-headers' as const };
    }

    const signatureParts = Object.fromEntries(
      xSignature.split(',').flatMap((part) => {
        const [key, value] = part.split('=', 2);
        if (!key || !value) {
          return [];
        }
        return [[key.trim(), value.trim()]];
      }),
    ) as Record<string, string>;

    const ts = signatureParts.ts;
    const hash = signatureParts.v1;

    if (!ts || !hash) {
      return { valid: false, reason: 'invalid-signature-format' as const };
    }

    const timestamp = Number(ts);
    if (!Number.isFinite(timestamp)) {
      return { valid: false, reason: 'invalid-timestamp' as const };
    }

    // MP reintenta una notificación fallida cada 15 minutos, y ese intervalo
    // se extiende más todavía después del tercer intento (sigue reintentando
    // hasta que respondamos 200) — con una ventana de 5 minutos, cualquier
    // rechazo transitorio (deploy en curso, cold start, etc.) en el primer
    // intento hacía que TODOS los reintentos también fallaran por esto,
    // perdiendo la orden aunque el pago estuviera aprobado. 24hs sigue
    // sirviendo como protección anti-replay sin descartar reintentos reales.
    const skewMs = Math.abs(Date.now() - timestamp);
    const maxSkewMs = 24 * 60 * 60 * 1000;
    if (skewMs > maxSkewMs) {
      return { valid: false, reason: 'timestamp-out-of-range' as const };
    }

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(hash, 'hex');
    if (expectedBuffer.length !== receivedBuffer.length) {
      return { valid: false, reason: 'signature-mismatch' as const };
    }

    return {
      valid: timingSafeEqual(expectedBuffer, receivedBuffer),
      reason: 'signature-checked' as const,
      timestamp,
    };
  }

  async getPaymentStatus(paymentId: string) {
    let payment: PaymentStatusResult | null = null;
    try {
      payment = await this.provider.getPayment(paymentId);
    } catch {
      // MP no respondió: tratamos como "sin datos remotos" en vez de romper.
      payment = null;
    }

    if (!payment) {
      return null;
    }

    const existing = await this.findExistingByPaymentId(String(payment.paymentId));

    if (payment.status === 'approved' && payment.orderPayload) {
      const finalized = await this.finalizeApprovedPayment(
        payment.orderPayload,
        payment.paymentId,
        undefined,
      );
      return {
        paymentId: payment.paymentId,
        status: 'approved',
        orderId: finalized.order.id,
      };
    }

    return {
      paymentId: payment.paymentId,
      status: payment.status ?? existing?.status ?? 'pending',
      orderId: existing?.orderId ?? null,
    };
  }

  async resolveReturn(params: {
    paymentId?: string | null;
    orderId?: string | null;
    preferenceId?: string | null;
    mpStatus?: string | null;
  }) {
    const paymentId = params.paymentId?.trim() || null;
    // "orderId" acá es en realidad el externalReference que le pusimos a la
    // preferencia (la orden todavía puede no existir). Ya no sirve para
    // buscar nada local: si el pago no está aprobado no hay ninguna fila que
    // consultar.
    const preferenceId = params.preferenceId?.trim() || null;
    const mpStatus = params.mpStatus?.trim() || null;

    let remotePayment: PaymentStatusResult | null = null;
    if (paymentId) {
      try {
        remotePayment = await this.provider.getPayment(paymentId);
      } catch {
        // MP no respondió (token de otro entorno, timeout, pago inexistente):
        // seguimos con el estado que llegó en el retorno del navegador.
        remotePayment = null;
      }
    }

    const existing = await this.findExistingByPaymentId(paymentId, preferenceId);

    const remoteStatus = remotePayment?.status ?? mpStatus ?? existing?.status ?? 'pending';

    let finalizeError: string | null = null;
    let order: ExistingOrder | null = existing?.order ?? null;

    if (remotePayment?.status === 'approved' && remotePayment.orderPayload && !existing) {
      try {
        const finalized = await this.finalizeApprovedPayment(
          remotePayment.orderPayload,
          remotePayment.paymentId,
          preferenceId ?? undefined,
        );
        order = finalized.order;
      } catch (err) {
        // Pago aprobado en MP pero no pudimos crear la orden (p. ej. sin
        // stock al momento de confirmar): no se guarda nada a medias.
        finalizeError = err instanceof Error ? err.message : 'No se pudo finalizar la orden';
      }
    }

    const remoteAmount = remotePayment?.transactionAmount ?? null;
    const expectedAmount = order ? Number(order.total) : null;
    const amountMatches =
      remoteAmount === null || expectedAmount === null
        ? null
        : Math.abs(remoteAmount - expectedAmount) < 0.01;

    return {
      verified: order ? amountMatches !== false : remoteStatus !== 'approved',
      finalizeError,
      paymentId: remotePayment?.paymentId ?? (paymentId ? Number(paymentId) : null),
      orderId: order?.id ?? null,
      orderNumber: order?.orderNumber ?? null,
      preferenceId: preferenceId ?? order?.payment?.preferenceId ?? null,
      status: order ? 'approved' : remoteStatus,
      amountMatches,
      expectedAmount,
      remoteAmount,
      localOrderStatus: order?.status ?? null,
      localPaymentStatus: order?.payment?.status ?? null,
    };
  }

  async handleWebhook(payload: any) {
    const paymentId = payload?.data?.id ?? payload?.id ?? payload?.payment_id;

    if (!paymentId) {
      return { received: true, orderId: null };
    }

    let payment: PaymentStatusResult | null = null;
    try {
      payment = await this.provider.getPayment(String(paymentId));
    } catch {
      payment = null;
    }

    if (!payment) {
      return { received: true, paymentId };
    }

    if (payment.status === 'approved' && payment.orderPayload) {
      const preferenceId =
        payload?.data?.preference_id ?? payload?.preference_id ?? undefined;
      try {
        const finalized = await this.finalizeApprovedPayment(
          payment.orderPayload,
          payment.paymentId,
          preferenceId,
        );
        return {
          received: true,
          paymentId: payment.paymentId,
          status: 'approved',
          orderId: finalized.order.id,
        };
      } catch (err) {
        this.logger.warn(
          `Pago ${payment.paymentId} aprobado pero no se pudo finalizar la orden: ${
            err instanceof Error ? err.message : err
          }`,
        );
        return { received: true, paymentId: payment.paymentId, status: payment.status };
      }
    }

    return {
      received: true,
      paymentId: payment.paymentId,
      status: payment.status,
    };
  }

  // Único punto de escritura de una orden nueva: solo se llama cuando MP ya
  // confirmó el pago como aprobado. Idempotente por Payment.externalId, así
  // que webhook + resolve (o reintentos) no duplican la orden.
  private async finalizeApprovedPayment(
    payload: PendingOrderPayload,
    mpPaymentId: number,
    preferenceId: string | undefined,
  ) {
    const externalId = String(mpPaymentId);

    const already = await this.prisma.payment.findUnique({
      where: { externalId },
      include: { order: { include: { items: { include: { product: true } }, payment: true } } },
    });
    if (already) {
      return { order: already.order, justCreated: false };
    }

    const order = await this.prisma.$transaction(async (tx) => {
      for (const item of payload.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || !product.active) {
          throw new Error(`Producto ${item.productId} no disponible`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Sin stock suficiente para ${product.name}`);
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      const created = await tx.order.create({
        data: {
          status: 'PAID',
          buyerName: payload.buyerName,
          buyerEmail: payload.buyerEmail,
          buyerPhone: payload.buyerPhone,
          buyerDni: payload.buyerDni,
          shippingStreet: payload.shippingStreet,
          shippingNumber: payload.shippingNumber,
          shippingCity: payload.shippingCity,
          shippingState: payload.shippingState,
          shippingZip: payload.shippingZip,
          shippingMethod: payload.shippingMethod,
          shippingCost: payload.shippingCost,
          itemsTotal: payload.itemsTotal,
          total: payload.total,
          items: {
            create: payload.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
          payment: {
            create: {
              provider: 'mercadopago',
              preferenceId,
              externalId,
              status: 'approved',
            },
          },
          // El envío se coordina a mano (ver panel admin /envios y /pedidos):
          // acá solo dejamos la orden marcada como "pendiente de preparar".
          shipment: {
            create: { provider: 'manual', status: 'pending' },
          },
        },
        include: {
          items: { include: { product: true } },
          payment: true,
          shipment: true,
        },
      });

      return created;
    });

    // Mails fuera de la transacción, y a propósito "best effort": si Resend
    // falla o no está configurado, no queremos que el pago falle por eso.
    const itemsForEmail = order.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    }));

    this.notifications
      .notifyOrderPaid({
        to: order.buyerEmail,
        buyerName: order.buyerName,
        orderNumber: order.orderNumber,
        items: itemsForEmail,
        itemsTotal: Number(order.itemsTotal),
        shippingCost: Number(order.shippingCost),
        shippingMethod: order.shippingMethod,
        total: Number(order.total),
      })
      .catch((err) => this.logger.warn(`No se pudo mandar el mail de confirmación: ${err.message}`));

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (adminEmail) {
      this.notifications
        .notifyAdminNewOrderPaid({
          to: adminEmail,
          orderNumber: order.orderNumber,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          total: Number(order.total),
        })
        .catch((err) => this.logger.warn(`No se pudo avisar al admin de la venta: ${err.message}`));
    }

    return { order, justCreated: true };
  }

  private async findExistingByPaymentId(paymentId?: string | null, preferenceId?: string | null) {
    if (!paymentId && !preferenceId) {
      return null;
    }
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          ...(paymentId ? [{ externalId: paymentId }] : []),
          ...(preferenceId ? [{ preferenceId }] : []),
        ],
      },
      include: { order: { include: { items: { include: { product: true } }, payment: true } } },
    });
    if (!payment) {
      return null;
    }
    return { status: payment.status, orderId: payment.orderId, order: payment.order };
  }
}
