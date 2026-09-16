'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StockAlert, getStockAlerts, getToken } from '@/lib/api';
import AdminShell from '../components/admin-shell';

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR');
}

export default function AvisosPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getStockAlerts();
      setAlerts(data);
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
    <AdminShell title="Avisos de stock" onRefresh={load} refreshing={loading}>
      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : alerts.length === 0 ? (
        <p>Todavía no hay avisos de stock pedidos.</p>
      ) : (
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Comprador</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td>{formatDate(alert.createdAt)}</td>
                <td>{alert.product?.name ?? alert.productId}</td>
                <td>{alert.buyerEmail}</td>
                <td>
                  <span className={`badge ${alert.notified ? 'badge-green' : 'badge-yellow'}`}>
                    {alert.notified ? 'Avisado' : 'Pendiente'}
                  </span>
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
