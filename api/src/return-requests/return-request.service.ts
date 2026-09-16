import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notification.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';

@Injectable()
export class ReturnRequestsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateReturnRequestDto) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });

    // No distinguimos "orden inexistente" de "email no coincide" en el
    // mensaje: alcanza con esto para que alguien no adivine órdenes ajenas
    // probando emails al azar, sin necesitar un login de cliente.
    if (!order || order.buyerEmail.toLowerCase() !== dto.buyerEmail.toLowerCase()) {
      throw new BadRequestException(
        'No encontramos una orden con ese número y ese email. Revisá los datos del mail de confirmación.',
      );
    }

    const request = await this.prisma.returnRequest.create({
      data: {
        orderId: dto.orderId,
        buyerEmail: dto.buyerEmail,
        reason: dto.reason,
        images: dto.images ?? [],
      },
    });

    const adminEmail =
      this.config.get<string>('ADMIN_NOTIFICATION_EMAIL') ||
      this.config.get<string>('ADMIN_EMAIL');
    if (adminEmail) {
      try {
        await this.notifications.notifyAdminNewReturnRequest({
          to: adminEmail,
          orderId: request.orderId,
          buyerEmail: request.buyerEmail,
          reason: request.reason,
          imagesCount: request.images.length,
        });
      } catch (err) {
        // Igual que en product-requests: un fallo de mail no debe tumbar la
        // creación del pedido de devolución.
        console.error('No se pudo notificar al admin de la devolución:', err);
      }
    }

    return request;
  }

  findAllForAdmin(status?: string) {
    return this.prisma.returnRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: { order: { include: { items: { include: { product: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string, adminNote?: string) {
    return this.prisma.returnRequest.update({
      where: { id },
      data: { status: status as any, ...(adminNote !== undefined ? { adminNote } : {}) },
    });
  }
}
