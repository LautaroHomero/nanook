'use client';

import { useRef, useState } from 'react';
import { useCart } from '@/lib/cart-context';

export default function AddToCartButton({
  productId,
  name,
  price,
  stock,
}: {
  productId: string;
  name: string;
  price: number;
  stock: number;
}) {
  const { addItem } = useCart();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [justAdded, setJustAdded] = useState(false);

  function handleClick() {
    if (!btnRef.current || stock <= 0) return;

    const wasAdded = addItem({ productId, name, price, quantity: 1, stock }, btnRef.current);
    if (!wasAdded) return;

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1000);
  }

  return (
    <button ref={btnRef} onClick={handleClick} disabled={justAdded || stock <= 0}>
      {stock <= 0 ? 'Sin stock' : justAdded ? 'Sumado a la pedalera ✓' : 'Agregar al carrito'}
    </button>
  );
}