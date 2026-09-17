const API_URL =
  typeof window === 'undefined'
    ? (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://api:3001')
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

const TOKEN_KEY = 'admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  hayStock: boolean;
  categoryId?: string | null;
  brandId?: string | null;
  images: string[];
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  children?: Category[];
}

export interface Brand {
  id: string;
  name: string;
  categoryId?: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product?: Product;
}

export interface Payment {
  id: string;
  provider: string;
  preferenceId?: string | null;
  externalId?: string | null;
  status: string;
}

export interface ProductSerial {
  id: string;
  productId: string;
  serialNumber: string;
  status: 'IN_STOCK' | 'SHIPPED';
  shipmentId?: string | null;
  createdAt: string;
  shippedAt?: string | null;
}

export interface Shipment {
  id: string;
  provider: string;
  trackingId?: string | null;
  status: string;
  serials?: ProductSerial[];
}

export interface Order {
  id: string;
  orderNumber: number;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED';
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
  shippingCost: number;
  itemsTotal: number;
  total: number;
  items: OrderItem[];
  payment: Payment | null;
  shipment: Shipment | null;
  createdAt: string;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Credenciales inválidas');
  const data = await res.json();
  setToken(data.accessToken);
  return data;
}

export async function getAllProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/products/admin/all`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
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

  const res = await fetch(`${API_URL}/api/products/admin/search?${qs.toString()}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('No se pudieron buscar los productos');
  return res.json();
}

export async function uploadImages(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const res = await fetch(`${API_URL}/api/uploads`, {
    method: 'POST',
    // OJO: no seteamos 'Content-Type' a mano — el navegador arma el boundary
    // del multipart/form-data solo. Si lo forzás, la subida se rompe.
    headers: { ...authHeaders() },
    body: formData,
  });
  if (!res.ok) throw new Error('No se pudieron subir las imágenes');
  const data = await res.json();
  return data.urls as string[];
}

export async function createProduct(data: Partial<Product>) {
  const res = await fetch(`${API_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('No se pudo crear el producto');
  return res.json();
}

export async function updateProduct(id: string, data: Partial<Product>) {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('No se pudo actualizar el producto');
  return res.json();
}

export async function deactivateProduct(id: string) {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('No se pudo dar de baja el producto');
  return res.json();
}

export async function activateProduct(id: string) {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ active: true }),
  });
  if (!res.ok) throw new Error('No se pudo reactivar el producto');
  return res.json();
}

// Ingresa stock nuevo cargando un número de serie por cada unidad.
export async function addProductStock(productId: string, serialNumbers: string[]): Promise<Product> {
  const res = await fetch(`${API_URL}/api/products/admin/${productId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ serialNumbers }),
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || 'No se pudo cargar el stock');
  }
  return res.json();
}

export async function getProductSerials(productId: string): Promise<ProductSerial[]> {
  const res = await fetch(`${API_URL}/api/products/admin/${productId}/serials`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('No se pudieron cargar los números de serie');
  return res.json();
}

export interface ProductRequest {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  notes?: string | null;
  buyerEmail: string;
  buyerPhone?: string | null;
  status: 'PENDING' | 'FULFILLED' | 'DISMISSED';
  linkedProduct?: Product | null;
  linkedProductId?: string | null;
  createdAt: string;
  fulfilledAt?: string | null;
}

export async function getProductRequests(status?: string): Promise<ProductRequest[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_URL}/api/product-requests/admin/all${qs}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('No se pudieron cargar los pedidos de producto');
  return res.json();
}

export async function dismissProductRequest(id: string) {
  const res = await fetch(`${API_URL}/api/product-requests/${id}/dismiss`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('No se pudo descartar el pedido');
  return res.json();
}

export async function linkProductRequest(id: string, productId: string) {
  const res = await fetch(`${API_URL}/api/product-requests/${id}/link/${productId}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('No se pudo vincular el producto');
  return res.json();
}

export interface StockAlert {
  id: string;
  productId: string;
  buyerEmail: string;
  notified: boolean;
  createdAt: string;
  notifiedAt?: string | null;
  product?: Product | null;
}

export async function getStockAlerts(): Promise<StockAlert[]> {
  const res = await fetch(`${API_URL}/api/stock-alerts/admin/all`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('No se pudieron cargar los avisos de stock');
  return res.json();
}

export async function getAllOrders(): Promise<Order[]> {
  const res = await fetch(`${API_URL}/api/orders/admin/all`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('No se pudieron cargar las compras');
  return res.json();
}

export async function getCategories(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/categories`, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudieron cargar las categorías');
  return res.json();
}

export async function addCategory(name: string, parentId?: string) {
  const res = await fetch(`${API_URL}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, parentId }),
  });
  if (!res.ok) throw new Error('No se pudo agregar la categoría');
  return res.json();
}

export async function deleteCategory(id: string) {
  const res = await fetch(`${API_URL}/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('No se pudo eliminar la categoría');
  return res.json();
}

export async function getBrands(categoryId?: string): Promise<Brand[]> {
  const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
  const res = await fetch(`${API_URL}/api/brands${qs}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudieron cargar las marcas');
  return res.json();
}

export async function addBrand(name: string, categoryId?: string) {
  const res = await fetch(`${API_URL}/api/brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, categoryId }),
  });
  if (!res.ok) throw new Error('No se pudo agregar la marca');
  return res.json();
}

export async function deleteBrand(id: string) {
  const res = await fetch(`${API_URL}/api/brands/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('No se pudo eliminar la marca');
  return res.json();
}

export interface ShippingRate {
  province: string;
  costSucursal: number;
  costDomicilio: number;
  estimatedDays: number;
  configured: boolean;
}

export async function getShippingRates(): Promise<ShippingRate[]> {
  const res = await fetch(`${API_URL}/api/shipping/rates/admin`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('No se pudieron cargar las tarifas de envío');
  return res.json();
}

export async function setShippingRate(
  province: string,
  costSucursal: number,
  costDomicilio: number,
  estimatedDays?: number,
) {
  const res = await fetch(`${API_URL}/api/shipping/rates/admin/${encodeURIComponent(province)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ costSucursal, costDomicilio, estimatedDays }),
  });
  if (!res.ok) throw new Error('No se pudo guardar la tarifa');
  return res.json();
}

export async function updateOrderShipment(
  orderId: string,
  status: string,
  options?: { note?: string; trackingId?: string; serialNumbers?: string[] },
) {
  const res = await fetch(`${API_URL}/api/orders/${orderId}/shipment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status, ...options }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || 'No se pudo actualizar el envío');
  }
  return res.json();
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  buyerEmail: string;
  reason: string;
  images: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  adminNote?: string | null;
  createdAt: string;
  order?: Order;
}

export async function getReturnRequests(): Promise<ReturnRequest[]> {
  const res = await fetch(`${API_URL}/api/return-requests/admin/all`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('No se pudieron cargar las devoluciones');
  return res.json();
}

export async function updateReturnRequestStatus(id: string, status: string, adminNote?: string) {
  const res = await fetch(`${API_URL}/api/return-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status, adminNote }),
  });
  if (!res.ok) throw new Error('No se pudo actualizar la devolución');
  return res.json();
}
