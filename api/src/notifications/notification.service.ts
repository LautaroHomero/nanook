import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MockNotificationProvider,
  NotificationProvider,
  ResendNotificationProvider,
} from './notification.provider';

@Injectable()
export class NotificationsService {
  private provider: NotificationProvider;

  constructor(config: ConfigService) {
    const resendApiKey = config.get<string>('RESEND_API_KEY');
    const from = config.get<string>('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';

    this.provider = resendApiKey
      ? new ResendNotificationProvider(resendApiKey, from)
      : new MockNotificationProvider();
  }

  notifyProductRequestFulfilled(params: {
    to: string;
    requestedName: string;
    productName: string;
    productUrl: string;
  }) {
    return this.provider.sendEmail({
      to: params.to,
      subject: `Ya está disponible: ${params.productName}`,
      body:
        `Nos pediste "${params.requestedName}" y lo acabamos de sumar al catálogo ` +
        `como "${params.productName}".\n\nMiralo acá: ${params.productUrl}`,
    });
  }

  notifyStockAvailable(params: {
    to: string;
    productName: string;
    productUrl: string;
  }) {
    return this.provider.sendEmail({
      to: params.to,
      subject: `Volvió el stock de ${params.productName}`,
      body:
        `${params.productName} ya tiene stock disponible de nuevo.\n\n` +
        `Miralo acá: ${params.productUrl}`,
    });
  }

  notifyAdminNewProductRequest(params: {
    to: string;
    name: string;
    brand?: string | null;
    category?: string | null;
    notes?: string | null;
    buyerEmail: string;
    buyerPhone?: string | null;
  }) {
    const lines = [
      `${params.buyerEmail} pidió un producto que no está en el catálogo:`,
      '',
      `Producto: ${params.name}`,
      params.brand ? `Marca: ${params.brand}` : null,
      params.category ? `Categoría: ${params.category}` : null,
      params.notes ? `Notas: ${params.notes}` : null,
      params.buyerPhone ? `Teléfono: ${params.buyerPhone}` : null,
    ].filter((line): line is string => line !== null);

    return this.provider.sendEmail({
      to: params.to,
      subject: `Nuevo pedido de producto: ${params.name}`,
      body: lines.join('\n'),
    });
  }
}