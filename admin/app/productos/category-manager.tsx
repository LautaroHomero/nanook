'use client';

import React, { useEffect, useState } from 'react';
import { getCategories, addCategory, deleteCategory } from '@/lib/api';

export default function CategoryManager({ onChange }: { onChange?: () => void }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [newCat, setNewCat] = useState('');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const list = await getCategories();
    setCategories(list || []);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!newCat.trim()) return;
    setLoading(true);
    try {
      await addCategory(newCat.trim(), parentId || undefined);
      setNewCat('');
      setParentId('');
      await load();
      onChange?.();
    } finally { setLoading(false); }
  }

  async function handleDel(id: string) {
    setLoading(true);
    try {
      await deleteCategory(id);
      await load();
      onChange?.();
    } finally { setLoading(false); }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input placeholder="Nueva categoría" value={newCat} onChange={(e)=>setNewCat(e.target.value)} />
        <select value={parentId} onChange={(e)=>setParentId(e.target.value)}>
          <option value="">Sin padre (nivel superior)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="button" onClick={handleAdd} disabled={loading || !newCat.trim()}>
          Agregar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {categories.map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ padding: '6px 10px', background: '#111', border: '1px solid #2a2a2c', borderRadius: 6 }}>{c.name}</span>
            <button type="button" className="secondary" onClick={() => handleDel(c.id)} disabled={loading}>
              Eliminar
            </button>
            {c.children?.map((ch:any) => (
              <div key={ch.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ padding: '6px 10px', background: '#111', border: '1px solid #2a2a2c', borderRadius: 6, marginLeft: 6 }}>↳ {ch.name}</span>
                <button type="button" className="secondary" onClick={() => handleDel(ch.id)} disabled={loading}>
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
