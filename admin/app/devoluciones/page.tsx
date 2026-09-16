'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ReturnRequest,
  clearToken,
  getReturnRequests,
  getToken,
  updateReturnRequestStatus,
} from '@/lib/api';

const STATUS_LABEL: Record<ReturnRequest['status'], string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  COMPLETED: 'Completada',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR');
}

export default function DevolucionesPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getReturnRequests();
      setRequests(data);
      setNoteDrafts(Object.fromEntries(data.map((r) => [r.id, r.adminNote ?? ''])));
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        router.push('/login');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStatusChange(id: string, status: string) {
    setBusyId(id);
    try {
      await updateReturnRequestStatus(id, status, noteDrafts[id]);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveNote(id: string) {
    const request = requests.find((r) => r.id === id);
    if (!request) return;
    setBusyId(id);
    try {
      await updateReturnRequestStatus(id, request.status, noteDrafts[id]);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <div className="top-bar">
        <h1>Devoluciones</h1>
        <button
          className="secondary"
          onClick={() => {
            clearToken();
            router.push('/login');
          }}
        >
          Salir
        </button>
      </div>

      <div className="row" style={{ marginBottom: 16, gap: 8 }}>
        <Link href="/productos"><button className="secondary">Productos</button></Link>
        <Link href="/pedidos"><button className="secondary">Compras</button></Link>
        <Link href="/solicitudes"><button className="secondary">Pedidos de producto</button></Link>
        <Link href="/avisos"><button className="secondary">Avisos de stock</button></Link>
        <Link href="/envios"><button className="secondary">Envíos</button></Link>
        <Link href="/devoluciones"><button>Devoluciones</button></Link>
        <button className="secondary" onClick={load}>Actualizar</button>
      </div>

      {error && <p style={{ color: '#e07b7b' }}>{error}</p>}

      {requests.length === 0 ? (
        <p>Todavía no hay pedidos de devolución.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Orden</th>
              <th>Comprador</th>
              <th>Fotos</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.flatMap((req) => {
              const rows = [
                <tr key={req.id}>
                  <td>{formatDate(req.createdAt)}</td>
                  <td>{req.orderId.slice(0, 8)}</td>
                  <td>{req.buyerEmail}</td>
                  <td>{req.images.length > 0 ? `${req.images.length} foto(s)` : 'Sin fotos'}</td>
                  <td>
                    <select
                      value={req.status}
                      disabled={busyId === req.id}
                      onChange={(e) => handleStatusChange(req.id, e.target.value)}
                      style={{ marginBottom: 0 }}
                    >
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    >
                      {expandedId === req.id ? 'Ocultar' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>,
              ];

              if (expandedId === req.id) {
                rows.push(
                  <tr key={`${req.id}-detail`}>
                    <td colSpan={6}>
                      <div style={{ padding: '8px 0' }}>
                        <p style={{ margin: '4px 0' }}>
                          <strong>Motivo:</strong> {req.reason}
                        </p>
                        {req.order && (
                          <p style={{ margin: '4px 0' }}>
                            <strong>Comprador:</strong> {req.order.buyerName} · {req.order.buyerPhone}
                            <br />
                            <strong>Envío:</strong> {req.order.shippingStreet} {req.order.shippingNumber},{' '}
                            {req.order.shippingCity}, {req.order.shippingState} ({req.order.shippingZip})
                          </p>
                        )}
                        {req.images.length > 0 && (
                          <div style={{ margin: '8px 0' }}>
                            <strong>Fotos:</strong>
                            <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                              {req.images.map((url) => (
                                <a key={url} href={url} target="_blank" rel="noreferrer">
                                  <img
                                    src={url}
                                    alt="Foto del producto devuelto"
                                    style={{ width: 96, height: 96, objectFit: 'cover', border: '1px solid var(--border)' }}
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        <label>
                          Nota interna
                          <textarea
                            rows={2}
                            value={noteDrafts[req.id] ?? ''}
                            onChange={(e) =>
                              setNoteDrafts((d) => ({ ...d, [req.id]: e.target.value }))
                            }
                          />
                        </label>
                        <button
                          className="secondary"
                          disabled={busyId === req.id}
                          onClick={() => handleSaveNote(req.id)}
                        >
                          Guardar nota
                        </button>
                      </div>
                    </td>
                  </tr>,
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
