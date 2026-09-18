'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  attachTransferReceipt,
  getBankDetails,
  getOrder,
  uploadTransferReceipt,
  type BankDetails,
} from '@/lib/api';

export default function CheckoutTransferenciaPage() {
  return (
    <Suspense fallback={<p>Cargando...</p>}>
      <TransferenciaView />
    </Suspense>
  );
}

function formatMoney(value: number) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

function TransferenciaView() {
  const params = useSearchParams();
  const orderId = params.get('orderId');

  const [order, setOrder] = useState<{ orderNumber: number; total: number } | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setLoadError('Falta el número de pedido en el enlace.');
      return;
    }
    let active = true;

    Promise.all([getOrder(orderId), getBankDetails()])
      .then(([orderData, bank]) => {
        if (!active) return;
        setOrder({ orderNumber: orderData.orderNumber, total: Number(orderData.total) });
        setBankDetails(bank);
      })
      .catch(() => {
        if (active) setLoadError('No pudimos encontrar ese pedido.');
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.type !== 'application/pdf') {
      setUploadError('El comprobante tiene que ser un archivo PDF');
      setFile(null);
      e.target.value = '';
      return;
    }
    setUploadError(null);
    setFile(selected);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !orderId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadTransferReceipt(file);
      await attachTransferReceipt(orderId, url);
      setUploaded(true);
    } catch (err: any) {
      setUploadError(err.message || 'No se pudo subir el comprobante');
    } finally {
      setUploading(false);
    }
  }

  if (loadError) {
    return (
      <div className="empty-state">
        <p className="eyebrow">Ups</p>
        <p>{loadError}</p>
      </div>
    );
  }

  if (!order || !bankDetails) {
    return <p>Cargando...</p>;
  }

  return (
    <div>
      <div className="page-heading">
        <h1>Pedido #{order.orderNumber} reservado</h1>
      </div>
      <p style={{ color: 'var(--text-dim)', marginBottom: 24, maxWidth: 480 }}>
        Te reservamos el pedido. Para confirmarlo, transferí el total a la siguiente cuenta y
        subí el comprobante — te avisamos por mail apenas confirmemos el pago.
      </p>

      <dl className="modal-summary">
        <dt>Total a transferir</dt>
        <dd>{formatMoney(order.total)}</dd>
        <dt>Banco</dt>
        <dd>{bankDetails.bankName}</dd>
        <dt>CBU</dt>
        <dd>{bankDetails.cbu}</dd>
        <dt>Alias</dt>
        <dd>{bankDetails.alias}</dd>
        <dt>Titular</dt>
        <dd>{bankDetails.holderName}</dd>
        <dt>CUIT / DNI</dt>
        <dd>{bankDetails.holderCuit}</dd>
      </dl>

      {uploaded ? (
        <div style={{ marginTop: 24 }}>
          <p>
            Recibimos tu comprobante. Lo estamos revisando y te vamos a avisar por mail apenas
            confirmemos el pago.
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            ¿Subiste el comprobante equivocado o te pidieron uno corregido?{' '}
            <button
              type="button"
              onClick={() => {
                setUploaded(false);
                setFile(null);
              }}
            >
              Subir otro comprobante
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={handleUpload} style={{ marginTop: 24 }}>
          <label>
            Comprobante de la transferencia (PDF)
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelected}
              disabled={uploading}
              required
            />
          </label>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: -8, marginBottom: 16 }}>
            Tiene que ser el PDF que te da tu banco o billetera al hacer la transferencia (no una
            foto ni una captura de pantalla).
          </p>

          {uploadError && (
            <p style={{ color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
              {uploadError}
            </p>
          )}

          <button type="submit" disabled={uploading || !file}>
            {uploading ? 'Subiendo...' : 'Subir comprobante'}
          </button>
        </form>
      )}
    </div>
  );
}
