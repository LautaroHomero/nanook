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
      <div className="inline-row" style={{ marginBottom: 10 }}>
        <input placeholder="Nueva categoría" value={newCat} onChange={(e)=>setNewCat(e.target.value)} />
        <select value={parentId} onChange={(e)=>setParentId(e.target.value)} style={{ width: 'auto', marginBottom: 0 }}>
          <option value="">Sin padre (nivel superior)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="button" className="secondary" onClick={handleAdd} disabled={loading || !newCat.trim()}>
          Agregar
        </button>
      </div>

      <div className="tag-list">
        {categories.map((c) => (
          <React.Fragment key={c.id}>
            <div className="tag">
              {c.name}
              <button type="button" onClick={() => handleDel(c.id)} disabled={loading} title="Eliminar">
                ×
              </button>
            </div>
            {c.children?.map((ch: any) => (
              <div className="tag child" key={ch.id}>
                ↳ {ch.name}
                <button type="button" onClick={() => handleDel(ch.id)} disabled={loading} title="Eliminar">
                  ×
                </button>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
