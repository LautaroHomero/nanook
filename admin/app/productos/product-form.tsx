'use client';

import React, { useState } from 'react';
import {
  Product,
  ProductSerial,
  createProduct,
  updateProduct,
  getCategories,
  getBrands,
  addBrand,
  uploadImages,
  addProductStock,
  getProductSerials,
} from '@/lib/api';
import CategoryManager from './category-manager';
import BrandManager from './brand-manager';

export default function ProductForm({
  product,
  onSaved,
  onCancel,
}: {
  product?: Product;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    categoryId: product?.categoryId ?? '',
    brandId: product?.brandId ?? '',
    images: product?.images ?? ([] as string[]),
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [newBrand, setNewBrand] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stock, setStock] = useState(product?.stock ?? 0);
  const [serials, setSerials] = useState<ProductSerial[]>([]);
  const [newSerials, setNewSerials] = useState('');
  const [addingStock, setAddingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  function update(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function loadCategories() {
    try {
      const list = await getCategories();
      setCategories(list || []);
      if (form.categoryId) {
        const b = await getBrands(form.categoryId);
        setBrands(b || []);
      }
    } catch (err) {
      // ignore
    }
  }

  React.useEffect(() => {
    loadCategories();
  }, []);

  async function loadSerials() {
    if (!product) return;
    try {
      const list = await getProductSerials(product.id);
      setSerials(list);
    } catch (e) {
      // ignore
    }
  }

  React.useEffect(() => {
    loadSerials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  async function handleAddStock() {
    if (!product) return;
    const serialNumbers = newSerials
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (serialNumbers.length === 0) {
      setStockError('Cargá al menos un número de serie (uno por línea)');
      return;
    }
    setAddingStock(true);
    setStockError(null);
    try {
      const updated = await addProductStock(product.id, serialNumbers);
      setStock(updated.stock);
      setNewSerials('');
      await loadSerials();
    } catch (err: any) {
      setStockError(err.message || 'No se pudo cargar el stock');
    } finally {
      setAddingStock(false);
    }
  }

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!form.categoryId) {
        setBrands([]);
        return;
      }
      try {
        const b = await getBrands(form.categoryId);
        if (mounted) setBrands(b || []);
      } catch (e) {}
    })();
    return () => {
      mounted = false;
    };
  }, [form.categoryId]);

  async function handleAddBrand() {
    if (!newBrand) return;
    try {
      const created = await addBrand(newBrand, form.categoryId || undefined);
      const b = await getBrands(form.categoryId);
      setBrands(b || []);
      setForm((f) => ({ ...f, brandId: created.id }));
      setNewBrand('');
    } catch (e: any) {
      setError(e.message || 'Error agregando marca');
    }
  }

  // Sube los archivos elegidos y agrega las URLs devueltas al final de la
  // lista de imágenes (mantiene el orden de subida — importante para el
  // visor 360° de la web, que gira siguiendo este mismo orden).
  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await uploadImages(files);
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err: any) {
      setError(err.message || 'No se pudieron subir las imágenes');
    } finally {
      setUploading(false);
      e.target.value = ''; // permite volver a elegir el mismo archivo después
    }
  }

  function removeImage(index: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
  }

  function moveImage(index: number, direction: -1 | 1) {
    setForm((f) => {
      const images = [...f.images];
      const target = index + direction;
      if (target < 0 || target >= images.length) return f;
      [images[index], images[target]] = [images[target], images[index]];
      return { ...f, images };
    });
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      categoryId: form.categoryId || undefined,
      brandId: form.brandId || undefined,
      images: form.images,
    };
    try {
      if (product) {
        await updateProduct(product.id, payload);
      } else {
        // El stock arranca en 0: se carga después agregando números de serie.
        await createProduct({ ...payload, stock: 0 });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>{product ? 'Editar producto' : 'Nuevo producto'}</h2>
      <input
        placeholder="Nombre"
        value={form.name}
        onChange={(e) => update('name', e.target.value)}
        required
      />
      <textarea
        placeholder="Descripción"
        value={form.description}
        onChange={(e) => update('description', e.target.value)}
        rows={3}
      />
      <div className="money-input">
        <span className="prefix">$</span>
        <input
          placeholder="Precio"
          type="number"
          step="0.01"
          value={form.price}
          onChange={(e) => update('price', e.target.value)}
          required
        />
      </div>
      {product ? (
        <div className="stock-manager" style={{ margin: '12px 0', padding: 12, border: '1px solid #444', borderRadius: 6 }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong>Stock actual:</strong> {stock} unidad{stock === 1 ? '' : 'es'}
          </p>
          <label>
            Agregar stock (un número de serie por línea, uno por unidad)
            <textarea
              placeholder={'NS-0001\nNS-0002'}
              value={newSerials}
              onChange={(e) => setNewSerials(e.target.value)}
              rows={3}
            />
          </label>
          <div className="row" style={{ marginTop: 6 }}>
            <button type="button" className="secondary" onClick={handleAddStock} disabled={addingStock}>
              {addingStock ? 'Agregando...' : 'Agregar stock'}
            </button>
          </div>
          {stockError && <p style={{ color: '#e07b7b' }}>{stockError}</p>}

          {serials.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary>Ver números de serie ({serials.length})</summary>
              <ul style={{ maxHeight: 160, overflowY: 'auto' }}>
                {serials.map((s) => (
                  <li key={s.id}>
                    {s.serialNumber} — {s.status === 'IN_STOCK' ? 'en stock' : 'enviado'}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <p style={{ opacity: 0.75 }}>
          El stock se carga después de crear el producto, agregando un número de serie por cada unidad.
        </p>
      )}
      <label>
        Categoría (opcional)
        <select value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)}>
          <option value="">-- Seleccionar --</option>
          {categories.map((c: any) => (
            <React.Fragment key={c.id}>
              <option value={c.id}>{c.name}</option>
              {c.children?.map((ch: any) => (
                <option key={ch.id} value={ch.id}>
                  {'\u00A0\u00A0'}— {ch.name}
                </option>
              ))}
            </React.Fragment>
          ))}
        </select>
      </label>

      <label>
        Marca (opcional)
        <select value={form.brandId} onChange={(e) => update('brandId', e.target.value)}>
          <option value="">-- Seleccionar --</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input
            placeholder="Nueva marca"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
          />
          <button type="button" className="secondary" onClick={handleAddBrand}>
            Agregar
          </button>
        </div>
      </label>

      <CategoryManager onChange={loadCategories} />
      <BrandManager onChange={() => { if (form.categoryId) loadCategories(); }} />

      <label>
        Fotos del producto
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          disabled={uploading}
        />
      </label>
      {uploading && <p style={{ opacity: 0.7 }}>Subiendo imágenes...</p>}

      {form.images.length > 0 && (
        <div className="image-preview-row">
          {form.images.map((url, i) => (
            <div className="image-preview" key={url}>
              <span className="image-order-badge">{i + 1}</span>
              <img src={url} alt={`Imagen ${i + 1}`} />
              <div className="image-actions">
                <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0}>
                  ←
                </button>
                <button type="button" onClick={() => removeImage(i)}>
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(i, 1)}
                  disabled={i === form.images.length - 1}
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ color: '#e07b7b' }}>{error}</p>}
      <div className="row">
        <button type="submit" disabled={loading || uploading}>
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}