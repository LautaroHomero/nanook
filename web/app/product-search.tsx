'use client';

import React, { useState, useEffect } from 'react';
import { Product, searchProducts, getCategories, getBrands } from '@/lib/api';
import ProductCard from './product-card';

export default function ProductSearch({ initial }: { initial: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initial);
  const [q, setQ] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStock, setInStock] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    setLoading(true);
    try {
      const res = await searchProducts({
        q: q || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock: inStock === '' ? undefined : inStock === 'true',
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
      });
      setProducts(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Auto-run search when filters change (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, minPrice, maxPrice, inStock, categoryId, brandId]);

  // load categories once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cats = await getCategories();
        if (mounted) setCategories(cats || []);
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, []);

  // load brands when category changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const bs = await getBrands(categoryId || undefined);
        if (mounted) setBrands(bs || []);
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, [categoryId]);

  return (
    <div>
      <div className="search-bar">
        <div className="search-field">
          <svg className="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input className="search-input" placeholder="Buscar nombre" value={q} onChange={(e)=>setQ(e.target.value)} />
        </div>

        <div className="filters">
          <input className="filter-input" placeholder="Precio min" type="number" value={minPrice} onChange={(e)=>setMinPrice(e.target.value)} />
          <input className="filter-input" placeholder="Precio max" type="number" value={maxPrice} onChange={(e)=>setMaxPrice(e.target.value)} />
          <select className="filter-input" value={categoryId} onChange={(e)=>setCategoryId(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((c)=> (
              <React.Fragment key={c.id}>
                <option value={c.id}>{c.name}</option>
                {c.children?.map((ch:any)=>(<option key={ch.id} value={ch.id}>&nbsp;&nbsp;— {ch.name}</option>))}
              </React.Fragment>
            ))}
          </select>
          <select className="filter-input" value={brandId} onChange={(e)=>setBrandId(e.target.value)}>
            <option value="">Todas las marcas</option>
            {brands.map((b)=> (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>

          <div className="stock-select" role="tablist" aria-label="Filtro stock">
            <button className={inStock === '' ? 'active' : ''} onClick={() => setInStock('')}>Todos</button>
            <button className={inStock === 'true' ? 'active' : ''} onClick={() => setInStock('true')}>Con stock</button>
            <button className={inStock === 'false' ? 'active' : ''} onClick={() => setInStock('false')}>Sin stock</button>
          </div>

          <div className="actions">
            <button onClick={handleSearch} disabled={loading}>{loading ? 'Buscando...' : 'Buscar'}</button>
          </div>
        </div>
      </div>

      <div className="results-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="results-info">{products.length} resultados</div>
        {loading && <div className="loading">Buscando...</div>}
      </div>

      <div className="product-grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {products.length === 0 && !loading && (
        <div className="empty-state">No se encontraron productos que coincidan con la búsqueda.</div>
      )}
    </div>
  );
}
