'use client';

import Link from 'next/link';
import { useCart } from '../lib/cart-context';

export default function PedalboardBadge() {
  const { count, pedalboardRef } = useCart();
  const slots = Math.min(count, 5);

  return (
    <Link href="/carrito" className="pedalboard-badge" ref={pedalboardRef}>
      <span className="mini-board">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`mini-pedal ${i < slots ? 'filled' : ''}`}
          />
        ))}
      </span>
      <span className="mini-count">
        {count > 0 ? `${count} en la pedalera` : 'Pedalera vacía'}
      </span>
    </Link>
  );
}