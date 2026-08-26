export interface ShippingQuoteInput {
  zip: string;
  weightKg?: number;
}

export interface ShippingQuoteResult {
  cost: number;
  estimatedDays: number;
}

export interface ShippingCreateInput {
  orderId: string;
  street: string;
  number: string;
  city: string;
  state: string;
  zip: string;
  buyerName: string;
  buyerPhone: string;
}

export interface ShippingCreateResult {
  trackingId: string;
}

export interface ShippingProvider {
  quote(input: ShippingQuoteInput): Promise<ShippingQuoteResult>;
  createShipment(input: ShippingCreateInput): Promise<ShippingCreateResult>;
}

// Implementación mock: usada mientras no haya credenciales reales de Andreani
// (ANDREANI_MOCK=true). Cuando tengas la cuenta, se reemplaza esta clase por
// una que llame a la API real, sin tocar orders/payments.
export class MockAndreaniProvider implements ShippingProvider {
  async quote(input: ShippingQuoteInput): Promise<ShippingQuoteResult> {
    // Costo simulado: base fija + variación simple por peso
    const base = 3500;
    const perKg = 500;
    const weight = input.weightKg ?? 1;
    return {
      cost: base + perKg * weight,
      estimatedDays: 5,
    };
  }

  async createShipment(
    input: ShippingCreateInput,
  ): Promise<ShippingCreateResult> {
    return {
      trackingId: `MOCK-AND-${input.orderId.slice(0, 8).toUpperCase()}`,
    };
  }
}
