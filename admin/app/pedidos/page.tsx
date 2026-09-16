'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Order, clearToken, getAllOrders, getToken, updateOrderShipment } from '@/lib/api';

const ORDER_STATUS_LABEL: Record<Order['status'], string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  SHIPPED: 'Enviada',
  CANCELLED: 'Cancelada',
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

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <div className="top-bar">
        <h1>Compras y pagos</h1>
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
        <Link href="/pedidos"><button>Compras</button></Link>
        <Link href="/solicitudes"><button className="secondary">Pedidos de producto</button></Link>
        <Link href="/avisos"><button className="secondary">Avisos de stock</button></Link>
        <Link href="/envios"><button className="secondary">Envíos</button></Link>
        <Link href="/devoluciones"><button className="secondary">Devoluciones</button></Link>
        <button className="secondary" onClick={load}>Actualizar</button>
      </div>

      {error && <p style={{ color: '#e07b7b' }}>{error}</p>}

      {orders.length === 0 ? (
        <p>Todavía no hay compras registradas.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Comprador</th>
              <th>Total</th>
              <th>Orden</th>
              <th>Pago</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.flatMap((order) => {
              const rows = [
                <tr key={order.id}>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    {order.buyerName}
                    <br />
                    <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{order.buyerEmail}</span>
                  </td>
                  <td>{formatMoney(order.total)}</td>
                  <td>{ORDER_STATUS_LABEL[order.status]}</td>
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
                    <td colSpan={6}>
                      <div style={{ padding: '8px 0' }}>
                        <p style={{ margin: '4px 0' }}>
                          <strong>Envío:</strong> {order.shippingStreet} {order.shippingNumber},{' '}
                          {order.shippingCity}, {order.shippingState} ({order.shippingZip}) —{' '}
                          {order.buyerPhone} ·{' '}
                          {order.shippingMethod === 'SUCURSAL' ? 'retiro en sucursal' : 'entrega a domicilio'}
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>Pago:</strong> {order.payment?.provider ?? '-'} · estado{' '}
                          {order.payment?.status ?? '-'} · id externo{' '}
                          {order.payment?.externalId ?? '-'}
                        </p>
                        {order.shipment && (
                          <p style={{ margin: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong>Envío:</strong>
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
                          </p>
                        )}
                        <p style={{ margin: '4px 0 8px' }}>
                          <strong>Items ({formatMoney(order.itemsTotal)} + envío{' '}
                          {formatMoney(order.shippingCost)}):</strong>
                        </p>
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
