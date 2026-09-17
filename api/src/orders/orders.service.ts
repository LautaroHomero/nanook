import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notification.service';
import { normalizeDniCuit } from '../common/dni-cuit';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private shipping: ShippingService,
    private payments: PaymentsService,
    private notifications: NotificationsService,
  ) {}

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payment: true,
        shipment: { include: { serials: true } },
      },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }

  async findAllForAdmin() {
    return this.prisma.order.findMany({
      include: {
        items: { include: { product: true } },
        payment: true,
        shipment: { include: { serials: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateShipment(orderId: string, dto: UpdateShipmentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');

    const existingShipment = await this.prisma.shipment.findUnique({ where: { orderId } });

    const { status, note, trackingId, serialNumbers } = dto;

    const shipment = await this.prisma.shipment.upsert({
      where: { orderId },
      create: {
        orderId,
        provider: 'manual',
        status,
        ...(note !== undefined ? { note } : {}),
        ...(trackingId !== undefined ? { trackingId } : {}),
      },
      update: {
        status,
        ...(note !== undefined ? { note } : {}),
        ...(trackingId !== undefined ? { trackingId } : {}),
      },
    });

    if (serialNumbers && serialNumbers.length > 0) {
      await this.assignShippedSerials(order, shipment.id, serialNumbers);
    }

    // Avisa al comprador la primera vez que el envío pasa a "shipped" con un
    // número de envío cargado (no en cada edición posterior, para no
    // duplicar el mail si el admin corrige algo después).
    const justShipped = status === 'shipped' && existingShipment?.status !== 'shipped';
    if (justShipped && shipment.trackingId) {
      await this.notifications.notifyOrderShipped({
        to: order.buyerEmail,
        buyerName: order.buyerName,
        orderNumber: order.orderNumber,
        trackingId: shipment.trackingId,
      });
    }

    return this.prisma.shipment.findUnique({
      where: { id: shipment.id },
      include: { serials: true },
    });
  }

  // Marca los números de serie cargados como despachados en este envío,
  // validando que existan, que sean de un producto de la orden, que no
  // estén ya asignados a otro envío y que no se pase la cantidad pedida.
  private async assignShippedSerials(
    order: { items: { productId: string; quantity: number; product: { name: string } }[] },
    shipmentId: string,
    serialNumbers: string[],
  ) {
    const trimmed = [...new Set(serialNumbers.map((s) => s.trim()).filter(Boolean))];
    if (trimmed.length === 0) return;

    const serials = await this.prisma.productSerial.findMany({
      where: { serialNumber: { in: trimmed } },
    });

    const found = new Set(serials.map((s) => s.serialNumber));
    const missing = trimmed.filter((s) => !found.has(s));
    if (missing.length > 0) {
      throw new BadRequestException(`Números de serie no encontrados: ${missing.join(', ')}`);
    }

    const itemByProductId = new Map(order.items.map((i) => [i.productId, i]));
    const foreign = serials.filter((s) => !itemByProductId.has(s.productId));
    if (foreign.length > 0) {
      throw new BadRequestException(
        `Estos números de serie no pertenecen a productos de esta orden: ${foreign.map((s) => s.serialNumber).join(', ')}`,
      );
    }

    const alreadyShipped = serials.filter(
      (s) => s.status === 'SHIPPED' && s.shipmentId !== shipmentId,
    );
    if (alreadyShipped.length > 0) {
      throw new BadRequestException(
        `Ya fueron despachados en otro envío: ${alreadyShipped.map((s) => s.serialNumber).join(', ')}`,
      );
    }

    // Cuenta por producto lo ya asignado a este envío (de una carga previa)
    // más lo nuevo, para no permitir cargar más unidades que las pedidas.
    const alreadyAssignedToShipment = await this.prisma.productSerial.findMany({
      where: { shipmentId, serialNumber: { notIn: trimmed } },
    });
    const countsByProduct = new Map<string, number>();
    for (const s of [...alreadyAssignedToShipment, ...serials]) {
      countsByProduct.set(s.productId, (countsByProduct.get(s.productId) ?? 0) + 1);
    }
    for (const item of order.items) {
      const count = countsByProduct.get(item.productId) ?? 0;
      if (count > item.quantity) {
        throw new BadRequestException(
          `Se cargaron más números de serie que unidades pedidas de ${item.product.name}`,
        );
      }
    }

    await this.prisma.productSerial.updateMany({
      where: { serialNumber: { in: trimmed } },
      data: { status: 'SHIPPED', shipmentId, shippedAt: new Date() },
    });
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

    // 2. Cotizar envío (tarifa fija manual por provincia + método elegido;
    // gratis si el subtotal de productos supera el umbral configurado)
    const shippingCost = await this.shipping.costForMethod(
      dto.shippingState,
      dto.shippingMethod,
      dto.shippingPartido,
      itemsTotal,
    );

    const total = itemsTotal + shippingCost;

    // 3. No se crea ninguna Order todavía: mientras el pago no esté aprobado
    // no queremos guardar nada de esta compra en la base. Todos los datos
    // necesarios para crear la orden viajan en la preferencia de pago y se
    // recuperan recién cuando Mercado Pago confirma el pago (ver
    // PaymentsService.finalizeApprovedPayment).
    const preference = await this.payments.createCheckout({
      title: `Compra Nanook (${dto.items.length} ${dto.items.length === 1 ? 'producto' : 'productos'})`,
      amount: total,
      buyerEmail: dto.buyerEmail,
      orderPayload: {
        buyerName: dto.buyerName,
        buyerEmail: dto.buyerEmail,
        buyerPhone: dto.buyerPhone,
        buyerDni: normalizeDniCuit(dto.buyerDni),
        shippingStreet: dto.shippingStreet,
        shippingNumber: dto.shippingNumber,
        shippingCity: dto.shippingCity,
        shippingState: dto.shippingState,
        shippingZip: dto.shippingZip,
        shippingMethod: dto.shippingMethod,
        items: itemsData,
        itemsTotal,
        shippingCost,
        total,
      },
    });

    return { payment: preference };
  }
}
