'use client';

import { useRef, useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { createStockAlert } from '@/lib/api';

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

  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const [alertEmail, setAlertEmail] = useState('');
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);

  function handleClick() {
    if (!btnRef.current || stock <= 0) return;

    const wasAdded = addItem(
      {
        productId,
        name,
        price,
        quantity,
        stock,
      },
      btnRef.current
    );

    if (!wasAdded) return;

    setJustAdded(true);

    setTimeout(() => {
      setJustAdded(false);
      setQuantity(1);
    }, 1000);
  }

  function increaseQuantity() {
    setQuantity((prev) => Math.min(prev + 1, stock));
  }

  function decreaseQuantity() {
    setQuantity((prev) => Math.max(prev - 1, 1));
  }

  async function handleAlertSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlertLoading(true);
    setAlertError(null);
    try {
      await createStockAlert({ productId, buyerEmail: alertEmail });
      setAlertSent(true);
    } catch (err: any) {
      setAlertError(err.message || 'No se pudo guardar el aviso');
    } finally {
      setAlertLoading(false);
    }
  }

  if (stock <= 0) {
    if (alertSent) {
      return (
        <p style={{ color: 'var(--text-dim)', margin: 0 }}>
          Listo, te avisamos por mail apenas tengamos stock.
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <button className="btn-primary" disabled>
          Sin stock
        </button>
        <form onSubmit={handleAlertSubmit} className="flex items-center gap-2">
          <input
            type="email"
            placeholder="Tu email para avisarte"
            value={alertEmail}
            onChange={(e) => setAlertEmail(e.target.value)}
            required
            style={{ marginBottom: 0 }}
          />
          <button type="submit" disabled={alertLoading}>
            {alertLoading ? 'Enviando...' : 'Avisame'}
          </button>
        </form>
        {alertError && (
          <p style={{ color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
            {alertError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Selector de cantidad */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={decreaseQuantity}
          disabled={quantity <= 1}
          className="px-3 py-1 border rounded"
        >
          −
        </button>

        <span className="min-w-8 text-center">
          {quantity}
        </span>

        <button
          type="button"
          onClick={increaseQuantity}
          disabled={quantity >= stock}
          className="px-3 py-1 border rounded"
        >
          +
        </button>
      </div>
      <button
        ref={btnRef}
        className="btn-primary"
        onClick={handleClick}
        disabled={justAdded}
      >
        {justAdded
          ? 'Sumado a la pedalera ✓'
          : `Agregar ${quantity} al carrito`}
      </button>
    </div>
  );
}