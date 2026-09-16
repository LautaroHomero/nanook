import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notification.service';
import { EmailAttachment } from '../notifications/notification.provider';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';

@Injectable()
export class ReturnRequestsService {
  private readonly logger = new Logger(ReturnRequestsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  // Baja la foto de donde esté guardada (Cloudinary en producción, disco
  // local en dev) para poder mandarla como adjunto real del mail. Si una
  // foto puntual falla, no tiramos abajo el resto — el mail sale igual con
  // las que sí se pudieron bajar.
  private async downloadAsAttachment(url: string, index: number): Promise<EmailAttachment | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;

      const buffer = Buffer.from(await res.arrayBuffer());
      const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
      if (buffer.length > MAX_ATTACHMENT_BYTES) return null;

      const ext = url.split('.').pop()?.split(/[?#]/)[0] || 'jpg';
      return { filename: `foto-devolucion-${index + 1}.${ext}`, content: buffer.toString('base64') };
    } catch (err) {
      this.logger.warn(`No se pudo bajar la foto de devolución (${url}): ${err.message}`);
      return null;
    }
  }

  async create(dto: CreateReturnRequestDto) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber: dto.orderNumber } });

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
        orderId: order.id,
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
        const attachments = (
          await Promise.all(request.images.map((url, i) => this.downloadAsAttachment(url, i)))
        ).filter((a): a is EmailAttachment => a !== null);

        await this.notifications.notifyAdminNewReturnRequest({
          to: adminEmail,
          orderNumber: order.orderNumber,
          buyerEmail: request.buyerEmail,
          reason: request.reason,
          attachments,
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
