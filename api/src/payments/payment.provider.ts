import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

export interface CreatePreferenceInput {
  orderId: string;
  title: string;
  amount: number;
  buyerEmail: string;
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
}

export interface PaymentProvider {
  createPreference(
    input: CreatePreferenceInput,
  ): Promise<CreatePreferenceResult>;

  getPayment(paymentId: string): Promise<PaymentStatusResult | null>;
}

function toOptionalNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function buildReturnUrl(baseUrl: string, route: string, orderId: string) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const url = new URL(`${normalizedBase}${route}`);
  url.searchParams.set('orderId', orderId);
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
      buildReturnUrl(baseUrl, '/checkout/success', input.orderId);
    const failureUrl =
      process.env.MP_FAILURE_URL ||
      buildReturnUrl(baseUrl, '/checkout/failure', input.orderId);
    const pendingUrl =
      process.env.MP_PENDING_URL ||
      buildReturnUrl(baseUrl, '/checkout/pending', input.orderId);

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
            id: input.orderId,
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
        external_reference: input.orderId,
        metadata: { orderId: input.orderId },
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
    };
  }
}

// Mock: usado mientras MP_MOCK=true o no hay token disponible.
export class MockMercadoPagoProvider implements PaymentProvider {
  async createPreference(
    input: CreatePreferenceInput,
  ): Promise<CreatePreferenceResult> {
    const fakeId = `MOCK-MP-${input.orderId.slice(0, 8)}`;
    return {
      preferenceId: fakeId,
      initPoint: `http://localhost:3003/checkout/mock-pago?orderId=${input.orderId}`,
    };
  }

  async getPayment(): Promise<PaymentStatusResult | null> {
    return null;
  }
}
