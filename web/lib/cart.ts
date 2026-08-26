export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock?: number;
}

const KEY = 'pedales_cart';

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function getAvailableStockForItem(item: CartItem) {
  const cart = getCart();
  const existing = cart.find((i) => i.productId === item.productId);
  const currentQuantity = existing ? existing.quantity : 0;
  const stock = item.stock ?? Number.MAX_SAFE_INTEGER;
  return Math.max(0, stock - currentQuantity);
}

export function addToCart(item: CartItem) {
  const cart = getCart();
  const existing = cart.find((i) => i.productId === item.productId);
  const productStock = item.stock ?? Number.MAX_SAFE_INTEGER;
  const currentQty = existing ? existing.quantity : 0;
  const available = Math.max(0, productStock - currentQty);
  const quantityToAdd = Math.min(item.quantity, available);

  if (quantityToAdd <= 0) {
    return cart;
  }

  if (existing) {
    existing.quantity += quantityToAdd;
  } else {
    cart.push({ ...item, quantity: quantityToAdd });
  }

  saveCart(cart);
  return cart;
}

export function removeFromCart(productId: string) {
  const cart = getCart().filter((i) => i.productId !== productId);
  saveCart(cart);
  return cart;
}

export function clearCart() {
  saveCart([]);
}

export function cartTotal(cart: CartItem[]) {
  return cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
}
