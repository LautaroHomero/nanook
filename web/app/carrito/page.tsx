'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { cartTotal } from '@/lib/cart';

export default function CartPage() {
  const { items, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p className="eyebrow">Pedalera vacía</p>
        <p>Todavía no agregaste ningún pedal.</p>
        <p>
          <Link href="/">Volver al catálogo</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-heading">
        <h1>Tu pedalera</h1>
        <span className="count">{items.length} pedales</span>
      </div>
      {items.map((item) => (
        <div className="cart-row" key={item.productId}>
          <span>
            {item.name} x{item.quantity}
          </span>
          <span>
            ${item.price * item.quantity}{' '}
            <button onClick={() => removeItem(item.productId)} style={{ marginLeft: 8 }}>
              Quitar
            </button>
          </span>
        </div>
      ))}
      <div className="total-row">
        <span>Total (sin envío)</span>
        <span>${cartTotal(items)}</span>
      </div>
      <Link href="/checkout">
        <button>Ir a checkout</button>
      </Link>
    </div>
  );
}