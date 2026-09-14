import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePreferenceInput,
  MercadoPagoProvider,
  MockMercadoPagoProvider,
  PaymentProvider,
  PaymentStatusResult,
} from './payment.provider';

@Injectable()
export class PaymentsService {
  private provider: PaymentProvider;
  private readonly mockMode: boolean;

  constructor(private prisma: PrismaService) {
    this.mockMode = process.env.MP_MOCK === 'true' || !process.env.MP_ACCESS_TOKEN;

    this.provider = this.mockMode
      ? new MockMercadoPagoProvider()
      : new MercadoPagoProvider(process.env.MP_ACCESS_TOKEN);
  }

  isMockMode() {
    return this.mockMode;
  }

  async createPreferenceForOrder(input: CreatePreferenceInput) {
    const result = await this.provider.createPreference(input);
    await this.prisma.payment.create({
      data: {
        orderId: input.orderId,
        preferenceId: result.preferenceId,
        status: 'pending',
      },
    });
    return result;
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

    const skewMs = Math.abs(Date.now() - timestamp);
    const maxSkewMs = 5 * 60 * 1000;
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

    const where = payment.externalReference
      ? {
          OR: [
            { externalId: String(payment.paymentId) },
            { orderId: payment.externalReference },
          ],
        }
      : {
          externalId: String(payment.paymentId),
        };

    const localPayment = await this.prisma.payment.findFirst({
      where,
      include: { order: true },
    });

    if (localPayment) {
      await this.prisma.payment.update({
        where: { orderId: localPayment.orderId },
        data: {
          externalId: String(payment.paymentId),
          status: payment.status ?? localPayment.status,
        },
      });
    }

    if (payment.status === 'approved' && payment.externalReference) {
      await this.markAsPaid(payment.externalReference);
    }

    return {
      paymentId: payment.paymentId,
      status: payment.status ?? localPayment?.status ?? 'pending',
      orderId: payment.externalReference ?? localPayment?.orderId ?? null,
    };
  }

  async resolveReturn(params: {
    paymentId?: string | null;
    orderId?: string | null;
    preferenceId?: string | null;
    mpStatus?: string | null;
  }) {
    const paymentId = params.paymentId?.trim() || null;
    const orderId = params.orderId?.trim() || null;
    const preferenceId = params.preferenceId?.trim() || null;
    const mpStatus = params.mpStatus?.trim() || null;

    const localPayment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          ...(paymentId ? [{ externalId: paymentId }] : []),
          ...(orderId ? [{ orderId }] : []),
          ...(preferenceId ? [{ preferenceId }] : []),
        ],
      },
      include: { order: true },
    });

    const resolveOrder = async (resolvedOrderId?: string | null) => {
      if (!resolvedOrderId) {
        return null;
      }

      return this.prisma.order.findUnique({
        where: { id: resolvedOrderId },
        include: { payment: true },
      });
    };

    let remotePayment: PaymentStatusResult | null = null;
    if (paymentId) {
      try {
        remotePayment = await this.provider.getPayment(paymentId);
      } catch {
        // MP no respondió (token de otro entorno, timeout, pago inexistente):
        // seguimos con el estado que llegó en el retorno del navegador y
        // dejamos que el webhook o un reintento lo confirmen.
        remotePayment = null;
      }
    }

    const resolvedOrderId =
      remotePayment?.externalReference ??
      localPayment?.orderId ??
      orderId ??
      null;
    const localOrder = await resolveOrder(resolvedOrderId);
    const remoteAmount = remotePayment?.transactionAmount ?? null;
    const expectedAmount = localOrder ? Number(localOrder.total) : null;
    const amountMatches =
      remoteAmount === null || expectedAmount === null
        ? null
        : Math.abs(remoteAmount - expectedAmount) < 0.01;

    const remoteStatus = remotePayment?.status ?? mpStatus ?? localPayment?.status ?? 'pending';
    const normalizedStatus = remoteStatus.toLowerCase();
    // Solo rechazamos ante un desajuste EXPLÍCITO de external_reference. Si MP
    // no devolvió external_reference pero el Payment local ya quedó atado a la
    // orden (por externalId / preferenceId / orderId), lo damos por válido.
    const referenceMismatch =
      !!remotePayment?.externalReference &&
      !!resolvedOrderId &&
      remotePayment.externalReference !== resolvedOrderId;
    const verifiedByReference = !referenceMismatch;
    const verifiedByAmount = amountMatches !== false;
    const verified = verifiedByReference && verifiedByAmount;
    const storedStatus =
      localPayment?.status === 'approved' || localOrder?.status === 'PAID'
        ? 'approved'
        : remoteStatus;

    if (localPayment) {
      await this.prisma.payment.update({
        where: { orderId: localPayment.orderId },
        data: {
          externalId: remotePayment?.paymentId ? String(remotePayment.paymentId) : localPayment.externalId,
          preferenceId: preferenceId ?? localPayment.preferenceId,
          status: storedStatus,
        },
      });
    }

    // Finaliza la orden sin romper la request si markAsPaid falla (p. ej.
    // faltante de stock al momento de aprobar): guardamos el motivo y lo
    // devolvemos para que el front lo muestre.
    let finalizeError: string | null = null;
    const finalize = async (id: string) => {
      try {
        await this.markAsPaid(id);
      } catch (err) {
        finalizeError =
          err instanceof Error ? err.message : 'No se pudo finalizar la orden';
      }
    };

    if (
      remotePayment?.status === 'approved' &&
      remotePayment.externalReference &&
      verified
    ) {
      await finalize(remotePayment.externalReference);
    } else if (
      normalizedStatus === 'approved' &&
      resolvedOrderId &&
      verified &&
      localOrder?.status !== 'PAID'
    ) {
      await finalize(resolvedOrderId);
    }

    return {
      verified,
      finalizeError,
      paymentId: remotePayment?.paymentId ?? (paymentId ? Number(paymentId) : null),
      orderId: resolvedOrderId,
      preferenceId: preferenceId ?? localPayment?.preferenceId ?? null,
      status: remoteStatus,
      amountMatches,
      expectedAmount,
      remoteAmount,
      localOrderStatus: localOrder?.status ?? null,
      localPaymentStatus: localPayment?.status ?? null,
    };
  }

  async handleWebhook(payload: any) {
    const paymentId = payload?.data?.id ?? payload?.id ?? payload?.payment_id;
    const legacyOrderId =
      payload?.data?.external_reference ??
      payload?.external_reference ??
      payload?.data?.metadata?.orderId;
    const preferenceId =
      payload?.data?.preference_id ??
      payload?.preference_id ??
      payload?.data?.metadata?.preferenceId;

    if (paymentId) {
      let payment: PaymentStatusResult | null = null;
      try {
        payment = await this.provider.getPayment(String(paymentId));
      } catch {
        payment = null;
      }

      if (!payment) {
        return { received: true, paymentId };
      }

      if (payment.status === 'approved' && payment.externalReference) {
        return this.resolveReturn({
          paymentId: String(paymentId),
          orderId: payment.externalReference,
          preferenceId,
          mpStatus: payment.status,
        });
      }

      return {
        received: true,
        paymentId: payment.paymentId,
        status: payment.status,
        orderId: payment.externalReference ?? legacyOrderId ?? null,
      };
    }

    if (legacyOrderId && (payload?.type === 'payment' || payload?.action === 'payment.updated')) {
      return this.markAsPaid(legacyOrderId);
    }

    return { received: true, orderId: legacyOrderId ?? null };
  }

  // Simula la confirmación de pago (webhook real de MP en el futuro llamará
  // a un endpoint parecido a este, validando la firma de MP)
  async markAsPaid(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, payment: true },
      });

      if (!order) {
        throw new Error(`Orden ${orderId} no encontrada`);
      }

      // Idempotencia: solo order.status === 'PAID' certifica que el stock ya
      // se descontó. payment.status puede llegar en 'approved' desde
      // resolveReturn/handleWebhook antes de correr esta transacción, así que
      // no sirve como señal de "ya procesado" (si lo usáramos, esta rama se
      // dispararía en la primera confirmación real y nunca decrementaría
      // stock ni marcaría la orden como pagada).
      if (order.status === 'PAID') {
        return {
          ...order,
          status: 'PAID',
          payment: { ...(order.payment ?? {}), status: 'approved' },
        };
      }

      for (const item of order.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });

        if (!product) {
          throw new Error(`Producto ${item.productId} no encontrado`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`Sin stock suficiente para ${product.name}`);
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      await tx.payment.update({
        where: { orderId },
        data: { status: 'approved' },
      });

      // El envío se coordina a mano (ver panel admin /envios y /pedidos):
      // acá solo dejamos la orden marcada como "pendiente de preparar".
      await tx.shipment.upsert({
        where: { orderId },
        create: { orderId, provider: 'manual', status: 'pending' },
        update: {},
      });

      return tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
        include: { items: { include: { product: true } }, payment: true, shipment: true },
      });
    });
  }
}
