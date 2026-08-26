'use client';

import React, { useEffect, useState } from 'react';
import { getBrands, addBrand, deleteBrand, getCategories } from '@/lib/api';

export default function BrandManager({ onChange }: { onChange?: () => void }) {
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [selCategory, setSelCategory] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    const b = await getBrands();
    setBrands(b || []);
    const cats = await getCategories();
    setCategories(cats || []);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await addBrand(newName.trim(), selCategory || undefined);
      setNewName('');
      await loadAll();
      onChange?.();
    } finally { setLoading(false); }
  }

  async function handleDel(id: string) {
    setLoading(true);
    try {
      await deleteBrand(id);
      await loadAll();
      onChange?.();
    } finally { setLoading(false); }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input placeholder="Nueva marca" value={newName} onChange={(e)=>setNewName(e.target.value)} />
        <select value={selCategory} onChange={(e)=>setSelCategory(e.target.value)}>
          <option value="">Sin categoría</option>
          {categories.map((c:any)=> (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="button" onClick={handleAdd} disabled={loading || !newName.trim()}>
          Agregar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {brands.map((b) => (
          <div key={b.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ padding: '6px 10px', background: '#111', border: '1px solid #2a2a2c', borderRadius: 6 }}>{b.name}</span>
            <button type="button" className="secondary" onClick={() => handleDel(b.id)} disabled={loading}>
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
