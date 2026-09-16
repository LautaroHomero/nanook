'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Product,
  ProductRequest,
  clearToken,
  dismissProductRequest,
  getAllProducts,
  getProductRequests,
  getToken,
  linkProductRequest,
} from '@/lib/api';

const STATUS_LABEL: Record<ProductRequest['status'], string> = {
  PENDING: 'Pendiente',
  FULFILLED: 'Resuelto',
  DISMISSED: 'Descartado',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR');
}

export default function SolicitudesPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reqs, prods] = await Promise.all([getProductRequests(), getAllProducts()]);
      setRequests(reqs);
      setProducts(prods.filter((p) => p.active));
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

  async function handleLink(requestId: string) {
    const productId = selectedProduct[requestId];
    if (!productId) return;
    setBusyId(requestId);
    try {
      await linkProductRequest(requestId, productId);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(requestId: string) {
    setBusyId(requestId);
    try {
      await dismissProductRequest(requestId);
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
        <h1>Pedidos de producto</h1>
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
        <Link href="/solicitudes"><button>Pedidos de producto</button></Link>
        <Link href="/avisos"><button className="secondary">Avisos de stock</button></Link>
        <Link href="/envios"><button className="secondary">Envíos</button></Link>
        <Link href="/devoluciones"><button className="secondary">Devoluciones</button></Link>
        <button className="secondary" onClick={load}>Actualizar</button>
      </div>

      {error && <p style={{ color: '#e07b7b' }}>{error}</p>}

      {requests.length === 0 ? (
        <p>Todavía no hay pedidos de producto.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto pedido</th>
              <th>Comprador</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id}>
                <td>{formatDate(req.createdAt)}</td>
                <td>
                  {req.name}
                  {(req.brand || req.category) && (
                    <>
                      <br />
                      <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                        {[req.brand, req.category].filter(Boolean).join(' · ')}
                      </span>
                    </>
                  )}
                  {req.notes && (
                    <>
                      <br />
                      <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{req.notes}</span>
                    </>
                  )}
                </td>
                <td>
                  {req.buyerEmail}
                  {req.buyerPhone && (
                    <>
                      <br />
                      <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{req.buyerPhone}</span>
                    </>
                  )}
                </td>
                <td>
                  {STATUS_LABEL[req.status]}
                  {req.status === 'FULFILLED' && req.linkedProduct && (
                    <>
                      <br />
                      <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                        {req.linkedProduct.name}
                      </span>
                    </>
                  )}
                </td>
                <td>
                  {req.status === 'PENDING' && (
                    <div className="row" style={{ gap: 6 }}>
                      <select
                        value={selectedProduct[req.id] ?? ''}
                        onChange={(e) =>
                          setSelectedProduct((s) => ({ ...s, [req.id]: e.target.value }))
                        }
                        style={{ marginBottom: 0, minWidth: 160 }}
                      >
                        <option value="">Vincular a...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="secondary"
                        disabled={!selectedProduct[req.id] || busyId === req.id}
                        onClick={() => handleLink(req.id)}
                      >
                        Vincular
                      </button>
                      <button
                        className="secondary"
                        disabled={busyId === req.id}
                        onClick={() => handleDismiss(req.id)}
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
