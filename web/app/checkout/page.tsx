'use client';

import { useState } from 'react';
import { cartTotal } from '@/lib/cart';
import { useCart } from '@/lib/cart-context';
import { createOrder, quoteShipping } from '@/lib/api';

export default function CheckoutPage() {
  const { items: cart, clear } = useCart();
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
    shippingStreet: '',
    shippingNumber: '',
    shippingCity: '',
    shippingState: '',
    shippingZip: '',
  });

  async function handleZipBlur() {
    if (!form.shippingZip) return;
    try {
      const quote = await quoteShipping(form.shippingZip);
      setShippingCost(quote.cost);
    } catch {
      setShippingCost(null);
    }
  }

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await createOrder({
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        ...form,
      });
      clear();
      // En producción esto redirige a result.payment.initPoint (checkout de MP real)
      window.location.href = result.payment.initPoint;
    } catch (err: any) {
      setError(err.message || 'Error al crear la orden');
      setLoading(false);
    }
  }

  if (cart.length === 0) {
    return <p>El carrito está vacío.</p>;
  }

  const total = cartTotal(cart) + (shippingCost ?? 0);

  return (
    <div>
      <h1>Checkout</h1>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Nombre y apellido"
          value={form.buyerName}
          onChange={(e) => update('buyerName', e.target.value)}
          required
        />
        <input
          placeholder="Email"
          type="email"
          value={form.buyerEmail}
          onChange={(e) => update('buyerEmail', e.target.value)}
          required
        />
        <input
          placeholder="Teléfono"
          value={form.buyerPhone}
          onChange={(e) => update('buyerPhone', e.target.value)}
          required
        />
        <input
          placeholder="Calle"
          value={form.shippingStreet}
          onChange={(e) => update('shippingStreet', e.target.value)}
          required
        />
        <input
          placeholder="Número"
          value={form.shippingNumber}
          onChange={(e) => update('shippingNumber', e.target.value)}
          required
        />
        <input
          placeholder="Ciudad"
          value={form.shippingCity}
          onChange={(e) => update('shippingCity', e.target.value)}
          required
        />
        <input
          placeholder="Provincia"
          value={form.shippingState}
          onChange={(e) => update('shippingState', e.target.value)}
          required
        />
        <input
          placeholder="Código postal"
          value={form.shippingZip}
          onChange={(e) => update('shippingZip', e.target.value)}
          onBlur={handleZipBlur}
          required
        />

        {shippingCost !== null && (
          <p>Costo de envío estimado: ${shippingCost}</p>
        )}

        <div className="total-row">
          <span>Total</span>
          <span>${total}</span>
        </div>

        {error && <p style={{ color: '#e07b7b' }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Procesando...' : 'Pagar con Mercado Pago'}
        </button>
      </form>
    </div>
  );
}