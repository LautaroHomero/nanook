'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Order,
  ShippingRate,
  getAllOrders,
  getShippingRates,
  getToken,
  setShippingRate,
  updateOrderShipment,
} from '@/lib/api';
import { SHIPMENT_STATUS_LABEL, SHIPMENT_STATUS_BADGE } from '@/lib/shipment-status';
import AdminShell from '../components/admin-shell';

function totalUnits(order: Order) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function EnviosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [statusDraft, setStatusDraft] = useState('pending');
  const [trackingDraft, setTrackingDraft] = useState('');
  const [serialsDraft, setSerialsDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [rateDrafts, setRateDrafts] = useState<Record<string, { sucursal: string; domicilio: string }>>({});
  const [ratesLoading, setRatesLoading] = useState(true);
  const [savingZone, setSavingZone] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const data = await getAllOrders();
      setOrders(data.filter((o) => o.shipment));
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        router.push('/login');
        return;
      }
      setRegisterError(err.message);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadRates() {
    setRatesLoading(true);
    try {
      const data = await getShippingRates();
      setRates(data);
      setRateDrafts(
        Object.fromEntries(
          data.map((r) => [r.zone, { sucursal: String(r.costSucursal), domicilio: String(r.costDomicilio) }]),
        ),
      );
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        router.push('/login');
        return;
      }
      setRatesError(err.message);
    } finally {
      setRatesLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    loadOrders();
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si se llega desde "Gestionar envío" en Compras, precargamos esa orden.
  useEffect(() => {
    const orderId = searchParams.get('order');
    if (orderId && orders.some((o) => o.id === orderId)) {
      selectOrder(orderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  function selectOrder(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    setSelectedOrderId(orderId);
    setStatusDraft(order?.shipment?.status ?? 'pending');
    setTrackingDraft(order?.shipment?.trackingId ?? '');
    setSerialsDraft('');
    setRegisterError(null);
  }

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  async function handleRegister() {
    if (!selectedOrderId) {
      setRegisterError('Elegí una compra');
      return;
    }
    setSaving(true);
    setRegisterError(null);
    try {
      const serialNumbers = serialsDraft.split('\n').map((s) => s.trim()).filter(Boolean);
      await updateOrderShipment(selectedOrderId, statusDraft, {
        trackingId: trackingDraft,
        ...(serialNumbers.length > 0 ? { serialNumbers } : {}),
      });
      setSerialsDraft('');
      await loadOrders();
    } catch (err: any) {
      setRegisterError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRate(zone: string) {
    const draft = rateDrafts[zone];
    const sucursal = Number(draft?.sucursal);
    const domicilio = Number(draft?.domicilio);
    if (!Number.isFinite(sucursal) || sucursal < 0 || !Number.isFinite(domicilio) || domicilio < 0) {
      setRatesError('Los costos tienen que ser números mayores o iguales a 0');
      return;
    }
    setSavingZone(zone);
    setRatesError(null);
    try {
      await setShippingRate(zone, sucursal, domicilio);
      await loadRates();
    } catch (err: any) {
      setRatesError(err.message);
    } finally {
      setSavingZone(null);
    }
  }

  return (
    <AdminShell
      title="Envíos"
      onRefresh={() => {
        loadOrders();
        loadRates();
      }}
      refreshing={ordersLoading || ratesLoading}
    >
      <section className="card">
        <h3>Registrar envío</h3>
        <p className="hint">
          Vinculá una compra pagada con el envío que salió: elegí la compra, cargá el número de
          envío y los números de serie de las unidades despachadas.
        </p>

        <label>
          Compra
          <select value={selectedOrderId} onChange={(e) => selectOrder(e.target.value)}>
            <option value="">-- Elegir compra --</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                #{o.orderNumber} · {o.buyerName} · {SHIPMENT_STATUS_LABEL[o.shipment?.status ?? 'pending']}
              </option>
            ))}
          </select>
        </label>

        {selectedOrder && (
          <>
            <div className="subcard">
              <h4>Productos pedidos</h4>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {selectedOrder.items.map((item) => (
                  <li key={item.id}>
                    {item.product?.name ?? item.productId} × {item.quantity}
                  </li>
                ))}
              </ul>
            </div>

            <div className="field-row">
              <label style={{ marginBottom: 0 }}>Estado</label>
              <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
                {Object.entries(SHIPMENT_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <label>
              Número de envío
              <input
                placeholder="Número de envío"
                value={trackingDraft}
                onChange={(e) => setTrackingDraft(e.target.value)}
              />
            </label>

            <label>
              Números de serie despachados (uno por línea)
              <textarea
                placeholder={'NS-0001\nNS-0002'}
                rows={3}
                value={serialsDraft}
                onChange={(e) => setSerialsDraft(e.target.value)}
              />
            </label>

            {selectedOrder.shipment?.serials && selectedOrder.shipment.serials.length > 0 && (
              <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Ya despachados: {selectedOrder.shipment.serials.map((s) => s.serialNumber).join(', ')}
              </p>
            )}

            {registerError && <p className="form-error">{registerError}</p>}

            <button onClick={handleRegister} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar envío'}
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h3>Envíos registrados</h3>
        {ordersLoading ? (
          <p>Cargando...</p>
        ) : orders.length === 0 ? (
          <p>Todavía no hay compras pagadas.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Comprador</th>
                  <th>Estado</th>
                  <th>N° de envío</th>
                  <th>Series despachadas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.orderNumber}</td>
                    <td>{o.buyerName}</td>
                    <td>
                      <span className={`badge ${SHIPMENT_STATUS_BADGE[o.shipment?.status ?? 'pending']}`}>
                        {SHIPMENT_STATUS_LABEL[o.shipment?.status ?? 'pending']}
                      </span>
                    </td>
                    <td>{o.shipment?.trackingId ?? '-'}</td>
                    <td>
                      {o.shipment?.serials?.length ?? 0} / {totalUnits(o)}
                    </td>
                    <td>
                      <button className="secondary" onClick={() => selectOrder(o.id)}>
                        Gestionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Costos de envío por zona</h3>
        <p className="hint">
          El envío se coordina a mano: acá se define cuánto se le cobra al cliente en el checkout
          según la zona de destino (armada a partir de la provincia y, en Buenos Aires, del
          partido), para retiro en sucursal o entrega a domicilio. Las zonas marcadas como "sin
          cargar" están usando el costo por defecto.
        </p>

        {ratesError && <p className="form-error">{ratesError}</p>}

        {ratesLoading ? (
          <p>Cargando...</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Sucursal ($)</th>
                  <th>Domicilio ($)</th>
                  <th>Días estimados</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.zone}>
                    <td>{rate.label}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={rateDrafts[rate.zone]?.sucursal ?? ''}
                        onChange={(e) =>
                          setRateDrafts((d) => ({
                            ...d,
                            [rate.zone]: { ...d[rate.zone], sucursal: e.target.value },
                          }))
                        }
                        style={{ width: 110, marginBottom: 0 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={rateDrafts[rate.zone]?.domicilio ?? ''}
                        onChange={(e) =>
                          setRateDrafts((d) => ({
                            ...d,
                            [rate.zone]: { ...d[rate.zone], domicilio: e.target.value },
                          }))
                        }
                        style={{ width: 110, marginBottom: 0 }}
                      />
                    </td>
                    <td>{rate.estimatedDays}</td>
                    <td>
                      <span className={`badge ${rate.configured ? 'badge-green' : 'badge-gray'}`}>
                        {rate.configured ? 'Cargada' : 'Sin cargar (default)'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="secondary"
                        disabled={savingZone === rate.zone}
                        onClick={() => handleSaveRate(rate.zone)}
                      >
                        {savingZone === rate.zone ? 'Guardando...' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

export default function EnviosPage() {
  return (
    <Suspense fallback={<p>Cargando...</p>}>
      <EnviosContent />
    </Suspense>
  );
}
