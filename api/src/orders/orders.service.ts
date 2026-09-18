import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notification.service';
import { normalizeDniCuit } from '../common/dni-cuit';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { UpdateBankDetailsDto } from './dto/update-bank-details.dto';
import { checkReceiptAgainstBankDetails, ReceiptCheckResult } from './receipt-verification';

interface BankDetails {
  bankName: string;
  cbu: string;
  alias: string;
  holderName: string;
  holderCuit: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private shipping: ShippingService,
    private payments: PaymentsService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  private getMpSurchargePercent(): number {
    const raw = this.config.get<string>('MP_SURCHARGE_PERCENT');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 4.3;
  }

  // Los BANK_TRANSFER_* de entorno son solo el valor por defecto para el
  // primer arranque (o si nunca se configuró desde el panel admin): en
  // cuanto el admin guarda algo desde /pedidos, la fila de la base manda.
  private getBankDetailsFromEnv(): BankDetails {
    return {
      bankName: this.config.get<string>('BANK_TRANSFER_BANK_NAME') || 'BBVA',
      cbu: this.config.get<string>('BANK_TRANSFER_CBU') || '',
      alias: this.config.get<string>('BANK_TRANSFER_ALIAS') || '',
      holderName: this.config.get<string>('BANK_TRANSFER_HOLDER_NAME') || '',
      holderCuit: this.config.get<string>('BANK_TRANSFER_HOLDER_CUIT') || '',
    };
  }

  private async getEffectiveBankDetails(): Promise<BankDetails & { configured: boolean }> {
    const stored = await this.prisma.bankTransferSettings.findUnique({ where: { id: 'singleton' } });
    if (stored) {
      return {
        bankName: stored.bankName,
        cbu: stored.cbu,
        alias: stored.alias,
        holderName: stored.holderName,
        holderCuit: stored.holderCuit,
        configured: true,
      };
    }
    return { ...this.getBankDetailsFromEnv(), configured: false };
  }

  async getPublicBankDetails(): Promise<BankDetails> {
    const { configured, ...details } = await this.getEffectiveBankDetails();
    return details;
  }

  // Admin: además del valor efectivo, informa si ya se configuró desde el
  // panel o si todavía está usando el default de las variables de entorno.
  async getBankDetailsForAdmin() {
    return this.getEffectiveBankDetails();
  }

  async updateBankDetails(dto: UpdateBankDetailsDto) {
    await this.prisma.bankTransferSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...dto },
      update: { ...dto },
    });
    return this.getBankDetailsForAdmin();
  }

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

    const buyerDni = normalizeDniCuit(dto.buyerDni);

    // 3. Transferencia bancaria: no hay forma de confirmar automáticamente
    // que la plata llegó a la cuenta (a diferencia de Mercado Pago), así que
    // la orden se crea ya mismo -reservando stock- y queda "pendiente" hasta
    // que el admin confirme el pago a mano desde el panel.
    if (dto.paymentMethod === 'TRANSFERENCIA') {
      const total = itemsTotal + shippingCost;

      const order = await this.prisma.$transaction(async (tx) => {
        for (const item of itemsData) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product || !product.active) {
            throw new BadRequestException(`Producto ${item.productId} no disponible`);
          }
          if (product.stock < item.quantity) {
            throw new BadRequestException(`Sin stock suficiente de ${product.name}`);
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        return tx.order.create({
          data: {
            status: 'PENDING',
            buyerName: dto.buyerName,
            buyerEmail: dto.buyerEmail,
            buyerPhone: dto.buyerPhone,
            buyerDni,
            shippingStreet: dto.shippingStreet,
            shippingNumber: dto.shippingNumber,
            shippingCity: dto.shippingCity,
            shippingState: dto.shippingState,
            shippingZip: dto.shippingZip,
            shippingMethod: dto.shippingMethod,
            shippingCost,
            itemsTotal,
            surchargeAmount: 0,
            total,
            items: { create: itemsData },
            payment: { create: { provider: 'transferencia', status: 'pending' } },
            shipment: { create: { provider: 'manual', status: 'pending' } },
          },
          include: { items: { include: { product: true } }, payment: true, shipment: true },
        });
      });

      const bankDetails = await this.getPublicBankDetails();

      this.notifications
        .notifyTransferInstructions({
          to: order.buyerEmail,
          buyerName: order.buyerName,
          orderNumber: order.orderNumber,
          total: Number(order.total),
          bankDetails,
        })
        .catch((err) => this.logger.warn(`No se pudo mandar el mail con los datos de transferencia: ${err.message}`));

      // A propósito no se avisa al admin todavía: mientras no haya
      // comprobante no hay nada que revisar. El aviso sale recién en
      // attachTransferReceipt.

      return {
        order: { id: order.id, orderNumber: order.orderNumber },
        payment: { method: 'TRANSFERENCIA' as const, total, bankDetails },
      };
    }

    // 4. Mercado Pago: se le suma el recargo que MP nos cobra de comisión.
    // No se crea ninguna Order todavía: mientras el pago no esté aprobado no
    // queremos guardar nada de esta compra en la base. Todos los datos
    // necesarios para crear la orden viajan en la preferencia de pago y se
    // recuperan recién cuando Mercado Pago confirma el pago (ver
    // PaymentsService.finalizeApprovedPayment).
    const baseTotal = itemsTotal + shippingCost;
    const surchargeAmount = Math.round(baseTotal * (this.getMpSurchargePercent() / 100) * 100) / 100;
    const total = baseTotal + surchargeAmount;

    const preference = await this.payments.createCheckout({
      title: `Compra Nanook (${dto.items.length} ${dto.items.length === 1 ? 'producto' : 'productos'})`,
      amount: total,
      buyerEmail: dto.buyerEmail,
      orderPayload: {
        buyerName: dto.buyerName,
        buyerEmail: dto.buyerEmail,
        buyerPhone: dto.buyerPhone,
        buyerDni,
        shippingStreet: dto.shippingStreet,
        shippingNumber: dto.shippingNumber,
        shippingCity: dto.shippingCity,
        shippingState: dto.shippingState,
        shippingZip: dto.shippingZip,
        shippingMethod: dto.shippingMethod,
        items: itemsData,
        itemsTotal,
        shippingCost,
        surchargeAmount,
        total,
      },
    });

    return { payment: { method: 'MERCADOPAGO' as const, ...preference } };
  }

  // Admin: el comprador subió el comprobante desde la web (o se lo mandó por
  // otro medio y el admin lo carga a mano) — solo se guarda, no confirma el
  // pago por sí solo.
  // Descarga el PDF ya subido (no confiamos en nada que mande el cliente
  // sobre el resultado del chequeo: se recalcula acá, del lado del server)
  // y lo compara contra los datos bancarios vigentes.
  private async verifyReceiptPdf(receiptUrl: string): Promise<ReceiptCheckResult> {
    try {
      const res = await fetch(receiptUrl);
      if (!res.ok) {
        return { status: 'mismatch', detail: 'No pudimos descargar el comprobante para verificarlo.' };
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const bankDetails = await this.getPublicBankDetails();
      return await checkReceiptAgainstBankDetails(buffer, bankDetails);
    } catch (err) {
      this.logger.warn(`No se pudo verificar el comprobante automáticamente: ${err.message}`);
      return { status: 'mismatch', detail: 'No pudimos verificar el comprobante automáticamente.' };
    }
  }

  // El comprador puede llamar esto más de una vez (por ejemplo, si el admin
  // le pidió que reenvíe un comprobante corregido): cada llamada pisa el
  // comprobante y el resultado del chequeo anteriores.
  async attachTransferReceipt(orderId: string, receiptUrl: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order || !order.payment) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (order.payment.provider !== 'transferencia' || order.payment.status !== 'pending') {
      throw new BadRequestException('Esta orden no tiene un pago por transferencia pendiente');
    }

    const check = await this.verifyReceiptPdf(receiptUrl);

    await this.prisma.payment.update({
      where: { orderId },
      data: { receiptUrl, receiptCheckStatus: check.status, receiptCheckDetail: check.detail },
    });

    const adminEmail = this.config.get<string>('ADMIN_NOTIFICATION_EMAIL');
    if (adminEmail) {
      this.notifications
        .notifyAdminTransferReceiptUploaded({
          to: adminEmail,
          orderNumber: order.orderNumber,
          checkPassed: check.status === 'match',
          checkDetail: check.detail,
        })
        .catch((err) => this.logger.warn(`No se pudo avisar al admin del comprobante: ${err.message}`));
    }

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, payment: true, shipment: true },
    });
  }

  // Admin: confirma a mano que la transferencia llegó. Único punto que pasa
  // una orden de transferencia de PENDING a PAID.
  async confirmTransferPayment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, payment: true },
    });
    if (!order || !order.payment) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (order.payment.provider !== 'transferencia' || order.payment.status !== 'pending') {
      throw new BadRequestException('Esta orden no tiene un pago por transferencia pendiente');
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { orderId }, data: { status: 'approved' } }),
      this.prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } }),
    ]);

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

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, payment: true, shipment: { include: { serials: true } } },
    });
  }

  // Admin: cancela un pedido que nunca se terminó de pagar y devuelve el
  // stock reservado. Solo tiene sentido para órdenes todavía PENDING (una
  // orden PAID/SHIPPED no se cancela desde acá).
  async cancelOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden cancelar órdenes pendientes');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
      if (order.payment) {
        await tx.payment.update({ where: { orderId }, data: { status: 'cancelled' } });
      }
    });

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, payment: true, shipment: true },
    });
  }
}
