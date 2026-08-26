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
