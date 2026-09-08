'use client';

import { useState } from 'react';
import { createProductRequest } from '@/lib/api';

export default function ProductRequestPage() {
  const [form, setForm] = useState({
    name: '',
    brand: '',
    category: '',
    notes: '',
    buyerEmail: '',
    buyerPhone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createProductRequest({
        name: form.name,
        brand: form.brand || undefined,
        category: form.category || undefined,
        notes: form.notes || undefined,
        buyerEmail: form.buyerEmail,
        buyerPhone: form.buyerPhone || undefined,
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'No se pudo enviar el pedido');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="empty-state">
        <p className="eyebrow">Listo</p>
        <p>Recibimos tu pedido.</p>
        <p>Te avisamos por mail apenas lo tengamos en el catálogo.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-heading">
        <h1>Pedir un producto</h1>
      </div>
      <p style={{ color: 'var(--text-dim)', marginBottom: 24, maxWidth: 480 }}>
        ¿No encontraste lo que buscabas? Contanos qué pedal o producto
        necesitás y te avisamos apenas lo sumemos al catálogo.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Nombre del producto"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          required
        />
        <input
          placeholder="Marca (opcional)"
          value={form.brand}
          onChange={(e) => update('brand', e.target.value)}
        />
        <input
          placeholder="Categoría (opcional)"
          value={form.category}
          onChange={(e) => update('category', e.target.value)}
        />
        <textarea
          placeholder="Detalles adicionales (opcional)"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={3}
        />
        <input
          placeholder="Tu email"
          type="email"
          value={form.buyerEmail}
          onChange={(e) => update('buyerEmail', e.target.value)}
          required
        />
        <input
          placeholder="Tu teléfono (opcional)"
          value={form.buyerPhone}
          onChange={(e) => update('buyerPhone', e.target.value)}
        />

        {error && <p style={{ color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar pedido'}
        </button>
      </form>
    </div>
  );
}