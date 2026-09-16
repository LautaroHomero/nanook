'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createReturnRequest, uploadReturnPhotos } from '@/lib/api';

export default function DevolucionesPage() {
  return (
    <Suspense fallback={null}>
      <DevolucionesForm />
    </Suspense>
  );
}

function DevolucionesForm() {
  const params = useSearchParams();
  const [form, setForm] = useState({
    orderId: params.get('orderId') ?? '',
    buyerEmail: '',
    reason: '',
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setPhotos(files);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let images: string[] = [];
      if (photos.length > 0) {
        setUploading(true);
        images = await uploadReturnPhotos(photos);
        setUploading(false);
      }

      await createReturnRequest({
        orderId: form.orderId.trim(),
        buyerEmail: form.buyerEmail.trim(),
        reason: form.reason,
        images,
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'No se pudo enviar la devolución');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  if (sent) {
    return (
      <div className="empty-state">
        <p className="eyebrow">Listo</p>
        <p>Recibimos tu pedido de devolución.</p>
        <p>Te vamos a contactar por mail para coordinar los próximos pasos.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-heading">
        <h1>Devolución de un producto</h1>
      </div>
      <p style={{ color: 'var(--text-dim)', marginBottom: 24, maxWidth: 480 }}>
        Completá los datos de tu compra y contanos qué pasó. Encontrás el número
        de orden en el mail de confirmación que te mandamos.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Número de orden"
          value={form.orderId}
          onChange={(e) => update('orderId', e.target.value)}
          required
        />
        <input
          placeholder="Email con el que compraste"
          type="email"
          value={form.buyerEmail}
          onChange={(e) => update('buyerEmail', e.target.value)}
          required
        />
        <textarea
          placeholder="Contanos qué pasó con el producto"
          value={form.reason}
          onChange={(e) => update('reason', e.target.value)}
          rows={4}
          minLength={10}
          required
        />

        <label>
          Fotos del producto (opcional)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            disabled={uploading || loading}
          />
        </label>
        <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: -8, marginBottom: 16 }}>
          No es obligatorio, pero es <strong>muy importante para agilizar el proceso</strong>:
          si podés, subí una o dos fotos que muestren el problema.
        </p>
        {photos.length > 0 && (
          <p style={{ fontSize: 12, marginTop: -8, marginBottom: 16 }}>
            {photos.length} foto{photos.length > 1 ? 's' : ''} seleccionada{photos.length > 1 ? 's' : ''}
          </p>
        )}

        {error && (
          <p style={{ color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {uploading ? 'Subiendo fotos...' : loading ? 'Enviando...' : 'Enviar devolución'}
        </button>
      </form>
    </div>
  );
}
