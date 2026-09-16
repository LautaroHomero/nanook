'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Order, getAllOrders, getToken, updateOrderShipment } from '@/lib/api';
import AdminShell from '../components/admin-shell';

const ORDER_STATUS_LABEL: Record<Order['status'], string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  SHIPPED: 'Enviada',
  CANCELLED: 'Cancelada',
};

const ORDER_STATUS_BADGE: Record<Order['status'], string> = {
  PENDING: 'badge-yellow',
  PAID: 'badge-green',
  SHIPPED: 'badge-green',
  CANCELLED: 'badge-red',
};

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente de preparar',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
};

function formatMoney(value: number) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR');
}

export default function PedidosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingShipmentId, setSavingShipmentId] = useState<string | null>(null);
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>({});
  const [serialDrafts, setSerialDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllOrders();
      setOrders(data);
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

  async function handleShipmentStatusChange(orderId: string, status: string) {
    setSavingShipmentId(orderId);
    try {
      await updateOrderShipment(orderId, status);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingShipmentId(null);
    }
  }

  async function handleSaveTracking(orderId: string, status: string) {
    const trackingId = trackingDrafts[orderId] ?? '';
    setSavingShipmentId(orderId);
    setError(null);
    try {
      await updateOrderShipment(orderId, status, { trackingId });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingShipmentId(null);
    }
  }

  async function handleSaveSerials(orderId: string, status: string) {
    const raw = serialDrafts[orderId] ?? '';
    const serialNumbers = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    if (serialNumbers.length === 0) {
      setError('Cargá al menos un número de serie');
      return;
    }
    setSavingShipmentId(orderId);
    setError(null);
    try {
      await updateOrderShipment(orderId, status, { serialNumbers });
      setSerialDrafts((d) => ({ ...d, [orderId]: '' }));
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingShipmentId(null);
    }
  }

  return (
    <AdminShell title="Compras y pagos" onRefresh={load} refreshing={loading}>
      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : orders.length === 0 ? (
        <p>Todavía no hay compras registradas.</p>
      ) : (
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>Comprador</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Pago</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.flatMap((order) => {
              const rows = [
                <tr key={order.id}>
                  <td>#{order.orderNumber}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    {order.buyerName}
                    <br />
                    <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{order.buyerEmail}</span>
                  </td>
                  <td>{formatMoney(order.total)}</td>
                  <td>
                    <span className={`badge ${ORDER_STATUS_BADGE[order.status]}`}>
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                  </td>
                  <td>{order.payment?.status ?? 'sin pago'}</td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    >
                      {expandedId === order.id ? 'Ocultar' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>,
              ];

              if (expandedId === order.id) {
                rows.push(
                  <tr key={`${order.id}-detail`}>
                    <td colSpan={7}>
                      <div className="detail-panel">
                        <dl className="detail-grid">
                          <dt>Envío a</dt>
                          <dd>
                            {order.shippingStreet} {order.shippingNumber}, {order.shippingCity},{' '}
                            {order.shippingState} ({order.shippingZip}) — {order.buyerPhone} ·{' '}
                            {order.shippingMethod === 'SUCURSAL' ? 'retiro en sucursal' : 'entrega a domicilio'}
                          </dd>
                          <dt>Pago</dt>
                          <dd>
                            {order.payment?.provider ?? '-'} · estado {order.payment?.status ?? '-'} · id
                            externo {order.payment?.externalId ?? '-'}
                          </dd>
                        </dl>

                        {order.shipment && (
                          <div className="subcard">
                            <h4>Gestión de envío</h4>

                            <div className="field-row">
                              <label>Estado</label>
                              <select
                                value={order.shipment.status}
                                disabled={savingShipmentId === order.id}
                                onChange={(e) => handleShipmentStatusChange(order.id, e.target.value)}
                              >
                                {Object.entries(SHIPMENT_STATUS_LABEL).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="field-row">
                              <label>N° de envío</label>
                              <input
                                placeholder="Número de envío"
                                value={trackingDrafts[order.id] ?? order.shipment.trackingId ?? ''}
                                disabled={savingShipmentId === order.id}
                                onChange={(e) =>
                                  setTrackingDrafts((d) => ({ ...d, [order.id]: e.target.value }))
                                }
                              />
                              <button
                                className="secondary"
                                disabled={savingShipmentId === order.id}
                                onClick={() => handleSaveTracking(order.id, order.shipment!.status)}
                              >
                                Guardar
                              </button>
                            </div>

                            <label>
                              Números de serie despachados (uno por línea)
                              <textarea
                                rows={2}
                                value={serialDrafts[order.id] ?? ''}
                                disabled={savingShipmentId === order.id}
                                onChange={(e) =>
                                  setSerialDrafts((d) => ({ ...d, [order.id]: e.target.value }))
                                }
                              />
                            </label>
                            <div className="row">
                              <button
                                className="secondary"
                                disabled={savingShipmentId === order.id}
                                onClick={() => handleSaveSerials(order.id, order.shipment!.status)}
                              >
                                Cargar números de serie
                              </button>
                            </div>
                            {order.shipment.serials && order.shipment.serials.length > 0 && (
                              <p style={{ margin: '10px 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
                                Ya despachados: {order.shipment.serials.map((s) => s.serialNumber).join(', ')}
                              </p>
                            )}
                          </div>
                        )}

                        <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Items ({formatMoney(order.itemsTotal)} + envío {formatMoney(order.shippingCost)})
                        </p>
                        <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th>Cantidad</th>
                              <th>Precio unit.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item) => (
                              <tr key={item.id}>
                                <td>{item.product?.name ?? item.productId}</td>
                                <td>{item.quantity}</td>
                                <td>{formatMoney(item.unitPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
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
