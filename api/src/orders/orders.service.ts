import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private shipping: ShippingService,
    private payments: PaymentsService,
  ) {}

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, payment: true, shipment: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }

  async create(dto: CreateOrderDto) {
    if (dto.items.length === 0) {
      throw new BadRequestException('La orden necesita al menos un item');
    }

    // 1. Traer precios y stock actuales (nunca confiar en precios del frontend)
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
    });

    let itemsTotal = 0;
    const itemsData = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product || !product.active) {
        throw new BadRequestException(
          `Producto ${item.productId} no disponible`,
        );
      }
      if (product.stock < item.quantity) {
        throw new BadRequestException(`Sin stock suficiente de ${product.name}`);
      }
      const unitPrice = Number(product.price);
      itemsTotal += unitPrice * item.quantity;
      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
      };
    });

    // 2. Cotizar envío
    const shippingQuote = await this.shipping.quote({
      zip: dto.shippingZip,
    });

    const total = itemsTotal + shippingQuote.cost;

    // 3. Crear orden con items y validar stock, pero NO descontarlo todavía.
    // El stock se descuenta solo cuando el pago queda aprobado en Mercado Pago.
    const order = await this.prisma.order.create({
      data: {
        buyerName: dto.buyerName,
        buyerEmail: dto.buyerEmail,
        buyerPhone: dto.buyerPhone,
        shippingStreet: dto.shippingStreet,
        shippingNumber: dto.shippingNumber,
        shippingCity: dto.shippingCity,
        shippingState: dto.shippingState,
        shippingZip: dto.shippingZip,
        shippingCost: shippingQuote.cost,
        itemsTotal,
        total,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    // 4. Generar preferencia de pago
    const preference = await this.payments.createPreferenceForOrder({
      orderId: order.id,
      title: `Orden ${order.id.slice(0, 8)}`,
      amount: total,
      buyerEmail: dto.buyerEmail,
    });

    return { order, payment: preference };
  }
}
