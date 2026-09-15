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

  notifyOrderPaid(params: {
    to: string;
    buyerName: string;
    orderId: string;
    items: { name: string; quantity: number; unitPrice: number }[];
    itemsTotal: number;
    shippingCost: number;
    shippingMethod: 'SUCURSAL' | 'DOMICILIO';
    total: number;
  }) {
    const money = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    const itemLines = params.items.map(
      (item) => `- ${item.quantity}x ${item.name} — ${money(item.unitPrice)} c/u`,
    );
    const shippingLine =
      params.shippingMethod === 'SUCURSAL'
        ? `Retiro en sucursal: ${money(params.shippingCost)}`
        : `Envío a domicilio: ${money(params.shippingCost)}`;

    return this.provider.sendEmail({
      to: params.to,
      subject: `Confirmamos tu compra en Nanook (orden ${params.orderId.slice(0, 8)})`,
      body: [
        `Hola ${params.buyerName},`,
        '',
        'Tu pago se acreditó y ya estamos preparando tu pedido. Resumen:',
        '',
        ...itemLines,
        '',
        `Subtotal productos: ${money(params.itemsTotal)}`,
        shippingLine,
        `Total: ${money(params.total)}`,
        '',
        'Te vamos a avisar por acá cuando el pedido salga hacia vos.',
      ].join('\n'),
    });
  }

  notifyAdminNewOrderPaid(params: {
    to: string;
    orderId: string;
    buyerName: string;
    buyerEmail: string;
    total: number;
  }) {
    return this.provider.sendEmail({
      to: params.to,
      subject: `Nueva venta: orden ${params.orderId.slice(0, 8)}`,
      body:
        `${params.buyerName} (${params.buyerEmail}) pagó la orden ${params.orderId}.\n\n` +
        `Total: $${params.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n\n` +
        `Revisala en el panel de admin (Compras) para coordinar el envío.`,
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