const API_URL =
  typeof window === 'undefined'
    ? process.env.API_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://api:3001'
    : process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  stock: number;
  category?: string | null;
  images: string[];
  active: boolean;
  hayStock: boolean;
}

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/products`, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudieron cargar los productos');
  return res.json();
}

export async function searchProducts(params: { q?: string; minPrice?: number; maxPrice?: number; inStock?: boolean; categoryId?: string; brandId?: string }) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.minPrice !== undefined) qs.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined) qs.set('maxPrice', String(params.maxPrice));
  if (params.inStock !== undefined) qs.set('inStock', String(params.inStock));
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.brandId) qs.set('brandId', params.brandId);

  const res = await fetch(`${API_URL}/api/products/search?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudieron buscar los productos');
  return res.json();
}

export async function getCategories() {
  const res = await fetch(`${API_URL}/api/categories`, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudieron cargar las categorías');
  return res.json();
}

export async function getBrands(categoryId?: string) {
  const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
  const res = await fetch(`${API_URL}/api/brands${qs}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudieron cargar las marcas');
  return res.json();
}

export async function getProduct(id: string): Promise<Product> {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Producto no encontrado');
  return res.json();
}

export async function quoteShipping(zip: string) {
  const res = await fetch(`${API_URL}/api/shipping/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zip }),
  });
  if (!res.ok) throw new Error('No se pudo cotizar el envío');
  return res.json();
}

export interface CheckoutPayload {
  items: { productId: string; quantity: number }[];
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
}

export async function createOrder(payload: CheckoutPayload) {
  const res = await fetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'No se pudo crear la orden');
  }
  return res.json();
}

export async function confirmOrderPayment(orderId: string) {
  const res = await fetch(`${API_URL}/api/payments/confirm/${orderId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('No se pudo confirmar el pago');
  return res.json();
}

export interface PaymentStatusResponse {
  paymentId: number;
  status: string;
  orderId: string | null;
}

export interface PaymentReturnResolution {
  verified: boolean;
  paymentId: number | null;
  orderId: string | null;
  preferenceId: string | null;
  status: string;
  amountMatches: boolean | null;
  expectedAmount: number | null;
  remoteAmount: number | null;
  localOrderStatus: string | null;
  localPaymentStatus: string | null;
}

export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse | null> {
  const res = await fetch(`${API_URL}/api/payments/status/${paymentId}`, {
    cache: 'no-store',
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error('No se pudo consultar el estado del pago');
  }

  return res.json();
}

export async function resolvePaymentReturn(params: {
  paymentId?: string | null;
  orderId?: string | null;
  preferenceId?: string | null;
  status?: string | null;
}): Promise<PaymentReturnResolution> {
  const qs = new URLSearchParams();
  if (params.paymentId) qs.set('paymentId', params.paymentId);
  if (params.orderId) qs.set('orderId', params.orderId);
  if (params.preferenceId) qs.set('preferenceId', params.preferenceId);
  if (params.status) qs.set('status', params.status);

  const res = await fetch(`${API_URL}/api/payments/resolve?${qs.toString()}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('No se pudo verificar el pago');
  }

  return res.json();
}

export async function mockConfirmPayment(orderId: string) {
  const res = await fetch(`${API_URL}/api/payments/mock-confirm/${orderId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('No se pudo confirmar el pago');
  return res.json();
}

export async function getOrder(id: string) {
  const res = await fetch(`${API_URL}/api/orders/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Orden no encontrada');
  return res.json();
}


export interface ProductRequestPayload {
  name: string;
  brand?: string;
  category?: string;
  notes?: string;
  buyerEmail: string;
  buyerPhone?: string;
}

export async function createProductRequest(payload: ProductRequestPayload) {
  const res = await fetch(`${API_URL}/api/product-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'No se pudo enviar el pedido');
  }
  return res.json();
}