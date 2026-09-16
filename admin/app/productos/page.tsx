'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Product,
  activateProduct,
  clearToken,
  deactivateProduct,
  getAllProducts,
  getToken,
  getCategories,
  getBrands,
} from '@/lib/api';
import ProductForm from './product-form';

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState<string>('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterBrandId, setFilterBrandId] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [catsMap, setCatsMap] = useState<Record<string, string>>({});
  const [brandsMap, setBrandsMap] = useState<Record<string, string>>({});

  async function load() {
    try {
      const data = await getAllProducts();
      setProducts(data);
      // load categories and brands for display
      try {
        const cats = await getCategories();
        const flat: Record<string, string> = {};
        (cats || []).forEach((c: any) => {
          flat[c.id] = c.name;
          (c.children || []).forEach((ch: any) => { flat[ch.id] = ch.name; });
        });
        setCatsMap(flat);
        const bs = await getBrands();
        const bm: Record<string, string> = {};
        (bs || []).forEach((b: any) => { bm[b.id] = b.name; });
        setBrandsMap(bm);
      } catch (e) {}
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    setLoading(true);
    try {
      const data = await (await import('@/lib/api')).searchProducts({
        q: query || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock: inStockOnly === '' ? undefined : inStockOnly === 'true',
        categoryId: filterCategoryId || undefined,
        brandId: filterBrandId || undefined,
      });
      setProducts(data);
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') router.push('/login');
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
        <h1>Productos</h1>
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
        <Link href="/productos"><button>Productos</button></Link>
        <Link href="/pedidos"><button className="secondary">Compras</button></Link>
        <Link href="/solicitudes"><button className="secondary">Pedidos de producto</button></Link>
        <Link href="/avisos"><button className="secondary">Avisos de stock</button></Link>
        <Link href="/envios"><button className="secondary">Envíos</button></Link>
        <Link href="/devoluciones"><button className="secondary">Devoluciones</button></Link>
      </div>

      {!showNew && !editing && (
        <div className="search-bar">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowNew(true)}>+ Nuevo producto</button>
          </div>

          <div className="search-controls">
            <div className="search-field h-[42px]" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg className="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input className="search-input" placeholder="Buscar por nombre" value={query} onChange={(e)=>setQuery(e.target.value)} />
            </div>

            <div className="filters">
              <input className="filter-input" placeholder="Precio min" type="number" value={minPrice} onChange={(e)=>setMinPrice(e.target.value)} />
              <input className="filter-input" placeholder="Precio max" type="number" value={maxPrice} onChange={(e)=>setMaxPrice(e.target.value)} />

              <select className="filter-input" value={filterCategoryId} onChange={(e)=>setFilterCategoryId(e.target.value)}>
                <option value="">Todas las categorías</option>
                {Object.entries(catsMap).map(([id,name])=> (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              <select className="filter-input" value={filterBrandId} onChange={(e)=>setFilterBrandId(e.target.value)}>
                <option value="">Todas las marcas</option>
                {Object.entries(brandsMap).map(([id,name])=> (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              <div className="stock-select" role="tablist" aria-label="Filtro stock">
                <button className={inStockOnly === '' ? 'active' : ''} onClick={() => setInStockOnly('')}>Todos</button>
                <button className={inStockOnly === 'true' ? 'active' : ''} onClick={() => setInStockOnly('true')}>Con stock</button>
                <button className={inStockOnly === 'false' ? 'active' : ''} onClick={() => setInStockOnly('false')}>Sin stock</button>
              </div>

              <div className="actions">
                <button className="secondary" onClick={handleSearch}>Buscar</button>
                <button onClick={load}>Reset</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <ProductForm
          onSaved={() => {
            setShowNew(false);
            load();
          }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {editing && (
        <ProductForm
          product={editing}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Categoría</th>
            <th>Marca</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p: Product) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>${p.price}</td>
              <td>{p.stock}</td>
              <td>{catsMap[p.categoryId ?? ''] ?? '-'}</td>
              <td>{brandsMap[p.brandId ?? ''] ?? '-'}</td>
              <td>{p.active ? 'Activo' : 'Inactivo'}</td>
              <td className="row">
                <button className="secondary" onClick={() => setEditing(p)}>
                  Editar
                </button>
                {p.active ? (
                  <button
                    className="secondary"
                    onClick={async () => {
                      await deactivateProduct(p.id);
                      load();
                    }}
                  >
                    Dar de baja
                  </button>
                ) : (
                  <button
                    className="secondary"
                    onClick={async () => {
                      await activateProduct(p.id);
                      load();
                    }}
                  >
                    Dar de alta
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
