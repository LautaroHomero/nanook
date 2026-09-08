import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notification.service';
import { CreateStockAlertDto } from './dto/create-stock-alert.dto';

@Injectable()
export class StockAlertsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateStockAlertDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // Evita duplicar el aviso si ya se anotó con el mismo mail para este producto.
    const existing = await this.prisma.stockAlert.findFirst({
      where: { productId: dto.productId, buyerEmail: dto.buyerEmail, notified: false },
    });
    if (existing) return existing;

    return this.prisma.stockAlert.create({
      data: { productId: dto.productId, buyerEmail: dto.buyerEmail },
    });
  }

  findAllForAdmin() {
    return this.prisma.stockAlert.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Lo llama ProductsService cuando el stock de un producto pasa de 0 a
  // positivo: avisa a todos los que se anotaron y los marca como notificados.
  async notifyStockRestocked(productId: string) {
    const alerts = await this.prisma.stockAlert.findMany({
      where: { productId, notified: false },
    });
    if (alerts.length === 0) return;

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) return;

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    for (const alert of alerts) {
      try {
        await this.notifications.notifyStockAvailable({
          to: alert.buyerEmail,
          productName: product.name,
          productUrl: `${frontendUrl}/producto/${product.id}`,
        });
      } catch (err) {
        // Seguimos con el resto de los avisos aunque uno falle, pero lo logueamos.
        console.error(`No se pudo notificar a ${alert.buyerEmail}:`, err);
      }
    }

    await this.prisma.stockAlert.updateMany({
      where: { productId, notified: false },
      data: { notified: true, notifiedAt: new Date() },
    });
  }
}
