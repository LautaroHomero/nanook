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

export interface PaymentProvider {
  createPreference(
    input: CreatePreferenceInput,
  ): Promise<CreatePreferenceResult>;
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

export class MercadoPagoProvider implements PaymentProvider {
  private readonly accessToken: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.MP_ACCESS_TOKEN || '';
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

    const notificationUrl =
      process.env.MP_NOTIFICATION_URL || `http://localhost:3001/api/payments/webhook`;

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
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
        notification_url: notificationUrl,
        external_reference: input.orderId,
        metadata: { orderId: input.orderId },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Mercado Pago no pudo crear la preferencia: ${response.status} ${errorBody}`,
      );
    }

    const data = await response.json();

    return {
      preferenceId: data.id,
      initPoint: data.init_point || data.sandbox_init_point || successUrl,
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
}
