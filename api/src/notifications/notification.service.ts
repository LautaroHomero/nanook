import { Injectable } from '@nestjs/common';
import {
  MockNotificationProvider,
  NotificationProvider,
} from './notification.provider';

@Injectable()
export class NotificationsService {
  private provider: NotificationProvider;

  constructor() {
    // TODO: cuando tengas un servicio de email real, instanciá esa
    // implementación acá en vez de MockNotificationProvider.
    this.provider = new MockNotificationProvider();
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
}