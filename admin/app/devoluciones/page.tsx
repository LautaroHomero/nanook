'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReturnRequest,
  getReturnRequests,
  getToken,
  updateReturnRequestStatus,
} from '@/lib/api';
import AdminShell from '../components/admin-shell';

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

  return (
    <AdminShell title="Devoluciones" onRefresh={load} refreshing={loading}>
      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : requests.length === 0 ? (
        <p>Todavía no hay pedidos de devolución.</p>
      ) : (
        <div className="table-scroll">
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
                  <td>{req.order ? `#${req.order.orderNumber}` : req.orderId.slice(0, 8)}</td>
                  <td>{req.buyerEmail}</td>
                  <td>{req.images.length > 0 ? `${req.images.length} foto(s)` : 'Sin fotos'}</td>
                  <td>
                    <select
                      value={req.status}
                      disabled={busyId === req.id}
                      onChange={(e) => handleStatusChange(req.id, e.target.value)}
                      style={{ marginBottom: 0, width: 'auto', minWidth: 150 }}
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
                      <div className="detail-panel">
                        <dl className="detail-grid">
                          {req.order && <dt>Orden</dt>}
                          {req.order && <dd>#{req.order.orderNumber}</dd>}
                          <dt>Motivo</dt>
                          <dd>{req.reason}</dd>
                          {req.order && (
                            <>
                              <dt>Comprador</dt>
                              <dd>{req.order.buyerName} · {req.order.buyerPhone}</dd>
                              <dt>Envío</dt>
                              <dd>
                                {req.order.shippingStreet} {req.order.shippingNumber},{' '}
                                {req.order.shippingCity}, {req.order.shippingState} ({req.order.shippingZip})
                              </dd>
                            </>
                          )}
                        </dl>
                        {req.images.length > 0 && (
                          <div style={{ margin: '0 0 16px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fotos</p>
                            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
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
        </div>
      )}
    </AdminShell>
  );
}
