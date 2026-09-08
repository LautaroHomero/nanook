import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notification.service';
import { CreateProductRequestDto } from './dto/create-product-request.dto';

@Injectable()
export class ProductRequestsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateProductRequestDto) {
    const request = await this.prisma.productRequest.create({ data: dto });

    const adminEmail =
      this.config.get<string>('ADMIN_NOTIFICATION_EMAIL') ||
      this.config.get<string>('ADMIN_EMAIL');
    if (adminEmail) {
      try {
        await this.notifications.notifyAdminNewProductRequest({
          to: adminEmail,
          name: request.name,
          brand: request.brand,
          category: request.category,
          notes: request.notes,
          buyerEmail: request.buyerEmail,
          buyerPhone: request.buyerPhone,
        });
      } catch (err) {
        // No queremos que un fallo de email tumbe la creación del pedido,
        // pero lo dejamos logueado para poder diagnosticarlo.
        console.error('No se pudo notificar al admin del nuevo pedido:', err);
      }
    }

    return request;
  }

  findAllForAdmin(status?: string) {
    return this.prisma.productRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: { linkedProduct: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async dismiss(id: string) {
    return this.prisma.productRequest.update({
      where: { id },
      data: { status: 'DISMISSED' },
    });
  }

  // Vincula un pedido pendiente con un producto ya creado y dispara el aviso
  // por email al que lo pidió. Es una acción manual del admin a propósito:
  // matchear nombres automáticamente ("Boss DS-1" vs "Distorsión Boss DS1")
  // es poco confiable, así que el admin confirma el link con un clic.
  async linkToProduct(requestId: string, productId: string) {
    const request = await this.prisma.productRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Pedido no encontrado');

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const updated = await this.prisma.productRequest.update({
      where: { id: requestId },
      data: {
        status: 'FULFILLED',
        linkedProductId: productId,
        fulfilledAt: new Date(),
      },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    await this.notifications.notifyProductRequestFulfilled({
      to: request.buyerEmail,
      requestedName: request.name,
      productName: product.name,
      productUrl: `${frontendUrl}/producto/${product.id}`,
    });

    return updated;
  }
}