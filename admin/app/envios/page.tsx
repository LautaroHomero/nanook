'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShippingRate, getShippingRates, getToken, setShippingRate } from '@/lib/api';
import AdminShell from '../components/admin-shell';

export default function EnviosPage() {
  const router = useRouter();
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { sucursal: string; domicilio: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingProvince, setSavingProvince] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getShippingRates();
      setRates(data);
      setDrafts(
        Object.fromEntries(
          data.map((r) => [
            r.province,
            { sucursal: String(r.costSucursal), domicilio: String(r.costDomicilio) },
          ]),
        ),
      );
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

  async function handleSave(province: string) {
    const draft = drafts[province];
    const sucursal = Number(draft?.sucursal);
    const domicilio = Number(draft?.domicilio);
    if (!Number.isFinite(sucursal) || sucursal < 0 || !Number.isFinite(domicilio) || domicilio < 0) {
      setError('Los costos tienen que ser números mayores o iguales a 0');
      return;
    }
    setSavingProvince(province);
    setError(null);
    try {
      await setShippingRate(province, sucursal, domicilio);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingProvince(null);
    }
  }

  return (
    <AdminShell title="Costos de envío por provincia" onRefresh={load} refreshing={loading}>
      <p className="card" style={{ opacity: 0.85, fontSize: '0.9rem' }}>
        El envío se coordina a mano: acá se define cuánto se le cobra al cliente en el checkout
        según su provincia, para retiro en sucursal o entrega a domicilio. Las provincias marcadas
        como "sin cargar" están usando el costo por defecto.
      </p>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Provincia</th>
            <th>Sucursal ($)</th>
            <th>Domicilio ($)</th>
            <th>Días estimados</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.province}>
              <td>{rate.province}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={drafts[rate.province]?.sucursal ?? ''}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [rate.province]: { ...d[rate.province], sucursal: e.target.value },
                    }))
                  }
                  style={{ width: 110 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={drafts[rate.province]?.domicilio ?? ''}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [rate.province]: { ...d[rate.province], domicilio: e.target.value },
                    }))
                  }
                  style={{ width: 110 }}
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
                  disabled={savingProvince === rate.province}
                  onClick={() => handleSave(rate.province)}
                >
                  {savingProvince === rate.province ? 'Guardando...' : 'Guardar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      )}
    </AdminShell>
  );
}
