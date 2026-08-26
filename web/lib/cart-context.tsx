'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  CartItem,
  addToCart as addToCartStorage,
  getCart,
  removeFromCart as removeFromCartStorage,
  clearCart as clearCartStorage,
} from './cart';

interface FlightRequest {
  id: number;
  fromRect: DOMRect;
  toRect: DOMRect;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  pedalboardRef: React.RefObject<HTMLAnchorElement>;
  addItem: (item: CartItem, fromEl: HTMLElement) => boolean;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [flight, setFlight] = useState<FlightRequest | null>(null);
  const pedalboardRef = useRef<HTMLAnchorElement>(null);
  const flightIdRef = useRef(0);

  useEffect(() => {
    setItems(getCart());
  }, []);

  const refresh = useCallback(() => setItems(getCart()), []);

  // Guarda el item ni bien se aprieta el botón; el contador del header
  // recién se actualiza cuando el "pedal" termina de volar y aterriza
  // (completeFlight), para que la animación se sienta como la causa real
  // del cambio y no algo cosmético superpuesto.
  const addItem = useCallback((item: CartItem, fromEl: HTMLElement) => {
    const cart = getCart();
    const existing = cart.find((i) => i.productId === item.productId);
    const currentQty = existing ? existing.quantity : 0;
    const productStock = item.stock ?? Number.MAX_SAFE_INTEGER;

    if (item.quantity <= 0 || currentQty + item.quantity > productStock) {
      return false;
    }

    addToCartStorage(item);
    const toEl = pedalboardRef.current;
    if (!toEl) {
      setItems(getCart());
      return true;
    }
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    flightIdRef.current += 1;
    setFlight({ id: flightIdRef.current, fromRect, toRect });
    return true;
  }, []);

  const completeFlight = useCallback(() => {
    setFlight(null);
    refresh();
  }, [refresh]);

  const removeItem = useCallback(
    (productId: string) => {
      removeFromCartStorage(productId);
      refresh();
    },
    [refresh],
  );

  const clear = useCallback(() => {
    clearCartStorage();
    refresh();
  }, [refresh]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, count, pedalboardRef, addItem, removeItem, clear }}
    >
      {children}
      {flight && <FlyingPedal flight={flight} onDone={completeFlight} />}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}

function FlyingPedal({
  flight,
  onDone,
}: {
  flight: FlightRequest;
  onDone: () => void;
}) {
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    // Monta en la posición de origen y recién en el frame siguiente dispara
    // la transición — si seteamos landed=true de una, no hay animación.
    const raf = requestAnimationFrame(() => setLanded(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const { fromRect, toRect } = flight;
  const size = 22;
  const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
  const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2);

  const style: React.CSSProperties = {
    position: 'fixed',
    left: fromRect.left + fromRect.width / 2 - size / 2,
    top: fromRect.top + fromRect.height / 2 - size / 2,
    width: size,
    height: size,
    transform: landed
      ? `translate(${dx}px, ${dy}px) scale(0.4) rotate(35deg)`
      : 'translate(0, 0) scale(1) rotate(0deg)',
    opacity: landed ? 0 : 1,
  };

  return (
    <div
      className="flying-pedal"
      style={style}
      onTransitionEnd={onDone}
      aria-hidden="true"
    />
  );
}