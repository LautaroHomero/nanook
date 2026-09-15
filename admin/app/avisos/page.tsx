'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StockAlert, clearToken, getStockAlerts, getToken } from '@/lib/api';

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

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <div className="top-bar">
        <h1>Avisos de stock</h1>
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
        <Link href="/avisos"><button>Avisos de stock</button></Link>
        <Link href="/envios"><button className="secondary">Envíos</button></Link>
        <button className="secondary" onClick={load}>Actualizar</button>
      </div>

      {error && <p style={{ color: '#e07b7b' }}>{error}</p>}

      {alerts.length === 0 ? (
        <p>Todavía no hay avisos de stock pedidos.</p>
      ) : (
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
                <td>{alert.notified ? 'Avisado' : 'Pendiente'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
