'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BankTransferDetails,
  Order,
  cancelOrder,
  confirmTransferPayment,
  getAllOrders,
  getBankDetails,
  getToken,
  updateBankDetails,
} from '@/lib/api';
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
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [bankDetails, setBankDetails] = useState<BankTransferDetails | null>(null);
  const [bankDraft, setBankDraft] = useState({
    bankName: '',
    cbu: '',
    alias: '',
    holderName: '',
    holderCuit: '',
  });
  const [bankLoading, setBankLoading] = useState(true);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankSaved, setBankSaved] = useState(false);

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

  async function loadBankDetails() {
    setBankLoading(true);
    try {
      const data = await getBankDetails();
      setBankDetails(data);
      setBankDraft({
        bankName: data.bankName,
        cbu: data.cbu,
        alias: data.alias,
        holderName: data.holderName,
        holderCuit: data.holderCuit,
      });
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        router.push('/login');
        return;
      }
      setBankError(err.message);
    } finally {
      setBankLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    load();
    loadBankDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateBankDraft(field: keyof typeof bankDraft, value: string) {
    setBankSaved(false);
    setBankDraft((d) => ({ ...d, [field]: value }));
  }

  async function handleSaveBankDetails() {
    setBankSaving(true);
    setBankError(null);
    setBankSaved(false);
    try {
      const updated = await updateBankDetails(bankDraft);
      setBankDetails(updated);
      setBankSaved(true);
    } catch (err: any) {
      setBankError(err.message);
    } finally {
      setBankSaving(false);
    }
  }

  async function handleConfirmTransfer(orderId: string) {
    setActionLoadingId(orderId);
    setError(null);
    try {
      await confirmTransferPayment(orderId);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!confirm('¿Cancelar este pedido y devolver el stock reservado?')) return;
    setActionLoadingId(orderId);
    setError(null);
    try {
      await cancelOrder(orderId);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <AdminShell
      title="Ventas y pagos"
      onRefresh={() => {
        load();
        loadBankDetails();
      }}
      refreshing={loading || bankLoading}
    >
      <section className="card">
        <h3>Datos bancarios para transferencia</h3>
        <p className="hint">
          Esto es lo que ve el comprador que elige pagar por transferencia en el checkout. Se
          usa apenas guardás — no hace falta redesplegar nada.
        </p>

        {bankLoading ? (
          <p>Cargando...</p>
        ) : (
          <>
            <p style={{ margin: '0 0 14px' }}>
              <span className={`badge ${bankDetails?.configured ? 'badge-green' : 'badge-gray'}`}>
                {bankDetails?.configured ? 'Configurado' : 'Usando valores por defecto'}
              </span>
            </p>

            <label>
              Banco
              <input value={bankDraft.bankName} onChange={(e) => updateBankDraft('bankName', e.target.value)} />
            </label>
            <label>
              CBU / CVU
              <input
                value={bankDraft.cbu}
                onChange={(e) => updateBankDraft('cbu', e.target.value.replace(/\D/g, ''))}
                maxLength={22}
                placeholder="22 dígitos"
              />
            </label>
            <label>
              Alias
              <input value={bankDraft.alias} onChange={(e) => updateBankDraft('alias', e.target.value)} />
            </label>
            <label>
              Titular
              <input
                value={bankDraft.holderName}
                onChange={(e) => updateBankDraft('holderName', e.target.value)}
              />
            </label>
            <label>
              CUIT / DNI del titular
              <input
                value={bankDraft.holderCuit}
                onChange={(e) => updateBankDraft('holderCuit', e.target.value)}
              />
            </label>

            {bankError && <p className="form-error">{bankError}</p>}
            {bankSaved && !bankError && <p className="hint">Guardado.</p>}

            <button onClick={handleSaveBankDetails} disabled={bankSaving}>
              {bankSaving ? 'Guardando...' : 'Guardar datos bancarios'}
            </button>
          </>
        )}
      </section>

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
                  <td>
                    {order.payment?.status ?? 'sin pago'}
                    {order.payment?.receiptCheckStatus === 'match' && (
                      <span
                        title={order.payment.receiptCheckDetail ?? ''}
                        style={{ marginLeft: 6, color: 'var(--accent)' }}
                      >
                        ✓
                      </span>
                    )}
                    {order.payment?.receiptCheckStatus === 'mismatch' && (
                      <span
                        title={order.payment.receiptCheckDetail ?? ''}
                        style={{ marginLeft: 6, color: 'var(--danger)' }}
                      >
                        ✗
                      </span>
                    )}
                  </td>
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
                          <dt>DNI / CUIT</dt>
                          <dd>{order.buyerDni || '—'}</dd>
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
                            {order.payment?.receiptUrl && (
                              <>
                                {' '}
                                ·{' '}
                                <a href={order.payment.receiptUrl} target="_blank" rel="noreferrer">
                                  Ver comprobante
                                </a>
                                {order.payment.receiptCheckStatus === 'match' && (
                                  <span style={{ color: 'var(--accent)', marginLeft: 6 }}>✓ coincide</span>
                                )}
                                {order.payment.receiptCheckStatus === 'mismatch' && (
                                  <span style={{ color: 'var(--danger)', marginLeft: 6 }}>✗ no coincide</span>
                                )}
                              </>
                            )}
                          </dd>
                        </dl>

                        {order.status === 'PENDING' && order.payment?.provider === 'transferencia' && (
                          <div className="subcard">
                            <h4>Transferencia pendiente de confirmar</h4>
                            {!order.payment.receiptUrl && (
                              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                El comprador todavía no subió ningún comprobante.
                              </p>
                            )}
                            {order.payment.receiptCheckStatus === 'match' && (
                              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                ✓ El chequeo automático coincide con nuestra cuenta ({order.payment.receiptCheckDetail}).
                                Es solo un chequeo de datos, no confirma que la plata haya llegado: revisá tu resumen
                                bancario y hacé el doble check antes de confirmar.
                              </p>
                            )}
                            {order.payment.receiptCheckStatus === 'mismatch' && (
                              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--danger)' }}>
                                ✗ El chequeo automático NO coincide ({order.payment.receiptCheckDetail}). Contactá al
                                comprador antes de confirmar: puede volver a subir un comprobante corregido desde el
                                mismo link, o cancelá el pedido si no se resuelve.
                              </p>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => handleConfirmTransfer(order.id)}
                                disabled={actionLoadingId === order.id}
                              >
                                {actionLoadingId === order.id ? 'Confirmando...' : 'Confirmar pago'}
                              </button>
                              <button
                                className="secondary"
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={actionLoadingId === order.id}
                              >
                                Cancelar pedido
                              </button>
                            </div>
                          </div>
                        )}

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
                          Items ({formatMoney(order.itemsTotal)} + envío {formatMoney(order.shippingCost)}
                          {order.surchargeAmount > 0 && <> + recargo MP {formatMoney(order.surchargeAmount)}</>})
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
