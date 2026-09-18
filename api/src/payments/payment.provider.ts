import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

// Datos de una orden todavía no pagada: no se guardan en nuestra base hasta
// que Mercado Pago confirme el pago. Viajan como metadata de la preferencia
// y MP los devuelve intactos en el pago resultante, así se puede reconstruir
// la orden recién en ese momento.
export interface PendingOrderPayload {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerDni: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  shippingMethod: 'SUCURSAL' | 'DOMICILIO';
  items: { productId: string; quantity: number; unitPrice: number }[];
  itemsTotal: number;
  shippingCost: number;
  // Recargo de Mercado Pago ya incluido en `total`.
  surchargeAmount: number;
  total: number;
}

export interface CreatePreferenceInput {
  externalReference: string;
  title: string;
  amount: number;
  buyerEmail: string;
  orderPayload: PendingOrderPayload;
}

export interface CreatePreferenceResult {
  preferenceId: string;
  initPoint: string; // URL a la que se redirige al comprador
}

export interface PaymentStatusResult {
  paymentId: number;
  status?: string;
  externalReference?: string;
  transactionAmount?: number;
  currencyId?: string;
  orderPayload?: PendingOrderPayload | null;
}

export interface PaymentProvider {
  createPreference(
    input: CreatePreferenceInput,
  ): Promise<CreatePreferenceResult>;

  getPayment(paymentId: string): Promise<PaymentStatusResult | null>;
}

function parseOrderPayload(raw: unknown): PendingOrderPayload | null {
  if (typeof raw !== 'string' || !raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PendingOrderPayload;
  } catch {
    return null;
  }
}

function toOptionalNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function buildReturnUrl(baseUrl: string, route: string, externalReference: string) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const url = new URL(`${normalizedBase}${route}`);
  url.searchParams.set('orderId', externalReference);
  return url.toString();
}

function isValidRedirectUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidHttpsUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1'
    );
  } catch {
    return false;
  }
}

export class MercadoPagoProvider implements PaymentProvider {
  private readonly accessToken: string;
  private readonly preference: Preference;
  private readonly payment: Payment;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.MP_ACCESS_TOKEN || '';
    const client = new MercadoPagoConfig({
      accessToken: this.accessToken,
      options: { timeout: 5000 },
    });
    this.preference = new Preference(client);
    this.payment = new Payment(client);
  }

  async createPreference(
    input: CreatePreferenceInput,
  ): Promise<CreatePreferenceResult> {
    if (!this.accessToken) {
      throw new Error('Falta MP_ACCESS_TOKEN para usar Mercado Pago');
    }

    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3003').replace(/\/$/, '');
    const successUrl =
      process.env.MP_SUCCESS_URL ||
      buildReturnUrl(baseUrl, '/checkout/success', input.externalReference);
    const failureUrl =
      process.env.MP_FAILURE_URL ||
      buildReturnUrl(baseUrl, '/checkout/failure', input.externalReference);
    const pendingUrl =
      process.env.MP_PENDING_URL ||
      buildReturnUrl(baseUrl, '/checkout/pending', input.externalReference);

    if (!successUrl || !failureUrl || !pendingUrl) {
      throw new Error(
        'Faltan las URLs de retorno de Mercado Pago: MP_SUCCESS_URL, MP_FAILURE_URL y MP_PENDING_URL',
      );
    }

    if (!isValidRedirectUrl(successUrl) || !isValidRedirectUrl(failureUrl) || !isValidRedirectUrl(pendingUrl)) {
      throw new Error(
        `Las URLs de retorno de Mercado Pago son inválidas. success=${successUrl}, failure=${failureUrl}, pending=${pendingUrl}`,
      );
    }

    const notificationUrl = process.env.MP_NOTIFICATION_URL?.trim();
    const useNotificationUrl =
      notificationUrl && !notificationUrl.includes('YOUR_PUBLIC_DOMAIN') && isValidHttpsUrl(notificationUrl)
        ? notificationUrl
        : null;

    const response = await this.preference.create({
      body: {
        items: [
          {
            id: input.externalReference,
            title: input.title,
            quantity: 1,
            unit_price: Number(input.amount.toFixed(2)),
            currency_id: process.env.MP_CURRENCY_ID || 'ARS',
          },
        ],
        payer: { email: input.buyerEmail },
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        external_reference: input.externalReference,
        // La orden todavía no existe en nuestra base: viaja completa acá
        // como JSON (un solo string, para que MP no reordene/aplane claves
        // anidadas) y recién se persiste cuando el pago vuelve aprobado.
        metadata: { order_payload: JSON.stringify(input.orderPayload) },
        ...(useNotificationUrl ? { notification_url: useNotificationUrl } : {}),
      },
    });

    return {
      preferenceId: String(response.id),
      initPoint: response.init_point || response.sandbox_init_point || successUrl,
    };
  }

  async getPayment(paymentId: string): Promise<PaymentStatusResult | null> {
    const id = Number(paymentId);

    if (!Number.isFinite(id)) {
      return null;
    }

    const payment = await this.payment.get({ id });

    if (!payment?.id) {
      return null;
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      externalReference: payment.external_reference,
      transactionAmount: toOptionalNumber(payment.transaction_amount),
      currencyId: payment.currency_id,
      orderPayload: parseOrderPayload(payment.metadata?.order_payload),
    };
  }
}

// Mock: usado mientras MP_MOCK=true o no hay token disponible. Como no hay
// una API externa que nos devuelva la orden más tarde, la guardamos en
// memoria (alcanza para dev/local, un solo proceso) mientras dura el pago
// simulado, y se descarta una vez confirmada.
export class MockMercadoPagoProvider implements PaymentProvider {
  private readonly pending = new Map<
    string,
    { payload: PendingOrderPayload; preferenceId: string }
  >();

  async createPreference(
    input: CreatePreferenceInput,
  ): Promise<CreatePreferenceResult> {
    const fakeId = `MOCK-MP-${input.externalReference.slice(0, 8)}`;
    this.pending.set(input.externalReference, {
      payload: input.orderPayload,
      preferenceId: fakeId,
    });
    return {
      preferenceId: fakeId,
      initPoint: `http://localhost:3003/checkout/mock-pago?orderId=${input.externalReference}`,
    };
  }

  // Usado por el endpoint de "pago simulado" para reconstruir el payload
  // guardado en createPreference, sin pasar por getPayment.
  consumePending(externalReference: string) {
    const entry = this.pending.get(externalReference);
    if (!entry) {
      return null;
    }
    this.pending.delete(externalReference);
    return entry;
  }

  async getPayment(): Promise<PaymentStatusResult | null> {
    return null;
  }
}
