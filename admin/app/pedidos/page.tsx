'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Order, getAllOrders, getToken } from '@/lib/api';
import { SHIPMENT_STATUS_LABEL, SHIPMENT_STATUS_BADGE } from '@/lib/shipment-status';
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
                            <h4>Envío</h4>
                            <p style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className={`badge ${SHIPMENT_STATUS_BADGE[order.shipment.status]}`}>
                                {SHIPMENT_STATUS_LABEL[order.shipment.status]}
                              </span>
                              {order.shipment.trackingId && <span>N° {order.shipment.trackingId}</span>}
                            </p>
                            {order.shipment.serials && order.shipment.serials.length > 0 && (
                              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Series despachadas: {order.shipment.serials.map((s) => s.serialNumber).join(', ')}
                              </p>
                            )}
                            <Link href={`/envios?order=${order.id}`}>
                              <button className="secondary">Gestionar envío</button>
                            </Link>
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
