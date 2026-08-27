import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePreferenceInput,
  MercadoPagoProvider,
  MockMercadoPagoProvider,
  PaymentProvider,
} from './payment.provider';

@Injectable()
export class PaymentsService {
  private provider: PaymentProvider;

  constructor(private prisma: PrismaService) {
    const useMock = process.env.MP_MOCK === 'true' || !process.env.MP_ACCESS_TOKEN;

    this.provider = useMock
      ? new MockMercadoPagoProvider()
      : new MercadoPagoProvider(process.env.MP_ACCESS_TOKEN);
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
    const payment = await this.provider.getPayment(paymentId);

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

    const remotePayment = paymentId ? await this.provider.getPayment(paymentId) : null;
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
    const verifiedByReference =
      !remotePayment || !resolvedOrderId || remotePayment.externalReference === resolvedOrderId;
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

    if (
      remotePayment?.status === 'approved' &&
      remotePayment.externalReference &&
      verified
    ) {
      await this.markAsPaid(remotePayment.externalReference);
    } else if (
      normalizedStatus === 'approved' &&
      resolvedOrderId &&
      verified &&
      localOrder?.status !== 'PAID'
    ) {
      await this.markAsPaid(resolvedOrderId);
    }

    return {
      verified,
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
      const payment = await this.provider.getPayment(String(paymentId));

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

      if (order.status === 'PAID' || order.payment?.status === 'approved') {
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

      return tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
        include: { items: { include: { product: true } }, payment: true },
      });
    });
  }
}
