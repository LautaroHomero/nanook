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

// Timeout corto para los fetch que corren durante el render del servidor:
// si la API no responde rápido (por ejemplo, un dominio mal configurado),
// no queremos que la página entera quede colgada — mejor falla rápido y
// que el catálogo se muestre vacío.
const SSR_FETCH_TIMEOUT_MS = 8000;

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/products`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(SSR_FETCH_TIMEOUT_MS),
  });
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

  const res = await fetch(`${API_URL}/api/products/search?${qs.toString()}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(SSR_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('No se pudieron buscar los productos');
  return res.json();
}

export async function getCategories() {
  const res = await fetch(`${API_URL}/api/categories`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(SSR_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('No se pudieron cargar las categorías');
  return res.json();
}

export async function getBrands(categoryId?: string) {
  const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
  const res = await fetch(`${API_URL}/api/brands${qs}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(SSR_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('No se pudieron cargar las marcas');
  return res.json();
}

export async function getProduct(id: string): Promise<Product> {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(SSR_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('Producto no encontrado');
  return res.json();
}

export async function quoteShipping(province: string, partido: string, itemsTotal: number) {
  const res = await fetch(`${API_URL}/api/shipping/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ province, partido, itemsTotal }),
  });
  if (!res.ok) throw new Error('No se pudo cotizar el envío');
  return res.json();
}

export interface CheckoutPayload {
  items: { productId: string; quantity: number }[];
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerDni: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingCity: string;
  shippingState: string;
  shippingPartido: string;
  shippingZip: string;
  shippingMethod: 'SUCURSAL' | 'DOMICILIO';
  paymentMethod: 'MERCADOPAGO' | 'TRANSFERENCIA';
}

export interface BankDetails {
  bankName: string;
  cbu: string;
  alias: string;
  holderName: string;
  holderCuit: string;
}

export interface CreateOrderResponse {
  payment:
    | { method: 'MERCADOPAGO'; initPoint: string; preferenceId: string }
    | { method: 'TRANSFERENCIA'; total: number; bankDetails: BankDetails };
  order?: { id: string; orderNumber: number };
}

export async function createOrder(payload: CheckoutPayload): Promise<CreateOrderResponse> {
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

export async function uploadTransferReceipt(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/uploads/transfer-receipt`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('No se pudo subir el comprobante');
  const data = await res.json();
  return data.url as string;
}

export async function getBankDetails(): Promise<BankDetails> {
  const res = await fetch(`${API_URL}/api/orders/bank-details`, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudieron obtener los datos bancarios');
  return res.json();
}

export async function attachTransferReceipt(orderId: string, receiptUrl: string) {
  const res = await fetch(`${API_URL}/api/orders/${orderId}/transfer-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiptUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'No se pudo adjuntar el comprobante');
  }
  return res.json();
}

export interface PaymentStatusResponse {
  paymentId: number;
  status: string;
  orderId: string | null;
}

export interface PaymentReturnResolution {
  verified: boolean;
  finalizeError?: string | null;
  paymentId: number | null;
  orderId: string | null;
  orderNumber: number | null;
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

export interface StockAlertPayload {
  productId: string;
  buyerEmail: string;
}

export async function createStockAlert(payload: StockAlertPayload) {
  const res = await fetch(`${API_URL}/api/stock-alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'No se pudo guardar el aviso');
  }
  return res.json();
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

export async function uploadReturnPhotos(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const res = await fetch(`${API_URL}/api/uploads/return-photos`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('No se pudieron subir las fotos');
  const data = await res.json();
  return data.urls as string[];
}

export interface ReturnRequestPayload {
  orderNumber: number;
  buyerEmail: string;
  reason: string;
  images?: string[];
}

export async function createReturnRequest(payload: ReturnRequestPayload) {
  const res = await fetch(`${API_URL}/api/return-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'No se pudo enviar la devolución');
  }
  return res.json();
}