import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailAttachment,
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
    orderNumber: number;
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
      subject: `Confirmamos tu compra en Nanook (orden #${params.orderNumber})`,
      body: [
        `Hola ${params.buyerName},`,
        '',
        `Tu pago se acreditó y ya estamos preparando tu pedido (orden #${params.orderNumber}). Resumen:`,
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

  notifyTransferInstructions(params: {
    to: string;
    buyerName: string;
    orderNumber: number;
    total: number;
    bankDetails: {
      bankName: string;
      cbu: string;
      alias: string;
      holderName: string;
      holderCuit: string;
    };
  }) {
    const money = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

    return this.provider.sendEmail({
      to: params.to,
      subject: `Datos para transferir tu compra en Nanook (orden #${params.orderNumber})`,
      body: [
        `Hola ${params.buyerName},`,
        '',
        `Reservamos tu pedido #${params.orderNumber}. Para confirmarlo, transferí ${money(params.total)} a:`,
        '',
        `Banco: ${params.bankDetails.bankName}`,
        `CBU: ${params.bankDetails.cbu}`,
        `Alias: ${params.bankDetails.alias}`,
        `Titular: ${params.bankDetails.holderName}`,
        `CUIT/DNI: ${params.bankDetails.holderCuit}`,
        '',
        'Una vez que transfieras, subí el comprobante en PDF desde la misma pantalla de la compra (el que te da tu banco o billetera, no una foto ni una captura de pantalla) para que podamos confirmar el pago.',
      ].join('\n'),
    });
  }

  // Único aviso al admin de un pedido por transferencia: a propósito no se
  // manda nada antes de que haya un comprobante para revisar (ver
  // OrdersService.create).
  notifyAdminTransferReceiptUploaded(params: {
    to: string;
    orderNumber: number;
    checkPassed: boolean;
    checkDetail: string;
  }) {
    const checkLine = params.checkPassed
      ? `✓ El chequeo automático coincide con nuestra cuenta: ${params.checkDetail}`
      : `✗ El chequeo automático NO coincide: ${params.checkDetail}`;

    return this.provider.sendEmail({
      to: params.to,
      subject: `${params.checkPassed ? '✓' : '✗'} Comprobante subido: orden #${params.orderNumber}`,
      body: [
        `El comprador de la orden #${params.orderNumber} subió el comprobante de transferencia.`,
        '',
        checkLine,
        '',
        params.checkPassed
          ? 'Es solo un chequeo automático de los datos de la cuenta, no confirma que la plata haya llegado: revisá tu resumen bancario antes de confirmar el pago en el panel de admin (Ventas).'
          : 'Antes de confirmar el pago, contactá al comprador para resolverlo: puede volver a subir un comprobante corregido desde el mismo link que ya tiene, o podés cancelar el pedido desde el panel si no se resuelve.',
      ].join('\n'),
    });
  }

  notifyOrderShipped(params: {
    to: string;
    buyerName: string;
    orderNumber: number;
    trackingId: string;
  }) {
    return this.provider.sendEmail({
      to: params.to,
      subject: `Tu pedido salió hacia vos (orden #${params.orderNumber})`,
      body: [
        `Hola ${params.buyerName},`,
        '',
        `Tu pedido (orden #${params.orderNumber}) ya salió hacia vos vía Andreani.`,
        '',
        `Número de envío: ${params.trackingId}`,
        '',
        'Podés seguirlo con ese número desde la web de Andreani.',
      ].join('\n'),
    });
  }

  notifyAdminNewOrderPaid(params: {
    to: string;
    orderNumber: number;
    buyerName: string;
    buyerEmail: string;
    total: number;
  }) {
    return this.provider.sendEmail({
      to: params.to,
      subject: `Nueva venta: orden #${params.orderNumber}`,
      body:
        `${params.buyerName} (${params.buyerEmail}) pagó la orden #${params.orderNumber}.\n\n` +
        `Total: $${params.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n\n` +
        `Revisala en el panel de admin (Compras) para coordinar el envío.`,
    });
  }

  notifyAdminNewReturnRequest(params: {
    to: string;
    orderNumber: number;
    buyerEmail: string;
    reason: string;
    attachments: EmailAttachment[];
  }) {
    const hasImages = params.attachments.length > 0;

    const body = [
      `${params.buyerEmail} pidió la devolución de la orden #${params.orderNumber}.`,
      '',
      `Motivo: ${params.reason}`,
      '',
      hasImages
        ? `Adjuntó ${params.attachments.length} foto(s) del producto (ver adjuntos de este mail).`
        : 'No adjuntó fotos del producto.',
      '',
      'Revisalo en el panel de admin (Devoluciones).',
    ].join('\n');

    return this.provider.sendEmail({
      to: params.to,
      subject: `Pedido de devolución: orden #${params.orderNumber}`,
      body,
      attachments: params.attachments,
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