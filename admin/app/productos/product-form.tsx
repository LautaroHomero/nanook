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
      <div className="product-form-header">
        <h2>{product ? 'Editar producto' : 'Nuevo producto'}</h2>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="product-form-grid">
        <div className="form-main">
          <section className="card">
            <h3>Datos generales</h3>
            <label>
              Nombre
              <input
                placeholder="Nombre del producto"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
              />
            </label>
            <label>
              Descripción
              <textarea
                placeholder="Descripción"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={4}
              />
            </label>
            <label>
              Precio
              <div className="money-input">
                <span className="prefix">$</span>
                <input
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => update('price', e.target.value)}
                  required
                />
              </div>
            </label>
          </section>

          <section className="card">
            <h3>Categorización</h3>
            <label>
              Categoría (opcional)
              <select value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {categories.map((c: any) => (
                  <React.Fragment key={c.id}>
                    <option value={c.id}>{c.name}</option>
                    {c.children?.map((ch: any) => (
                      <option key={ch.id} value={ch.id}>
                        {'  '}— {ch.name}
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
            </label>
            <div className="inline-row" style={{ marginBottom: 14 }}>
              <input
                placeholder="Nueva marca"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
              />
              <button type="button" className="secondary" onClick={handleAddBrand}>
                Agregar
              </button>
            </div>

            <details className="taxonomy">
              <summary>Gestionar categorías y marcas</summary>
              <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Categorías</p>
              <CategoryManager onChange={loadCategories} />
              <p style={{ margin: '10px 0 6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Marcas</p>
              <BrandManager onChange={() => { if (form.categoryId) loadCategories(); }} />
            </details>
          </section>
        </div>

        <div className="form-side">
          <section className="card">
            <h3>Fotos</h3>
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
            {uploading && <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>Subiendo imágenes...</p>}

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
          </section>

          {product ? (
            <section className="card stock-manager">
              <h3>Stock</h3>
              <p className="stock-count">
                <strong>{stock}</strong> unidad{stock === 1 ? '' : 'es'} en stock
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
              <button type="button" className="secondary" onClick={handleAddStock} disabled={addingStock}>
                {addingStock ? 'Agregando...' : 'Agregar stock'}
              </button>
              {stockError && <p className="form-error" style={{ marginTop: 10 }}>{stockError}</p>}

              {serials.length > 0 && (
                <details className="taxonomy" style={{ marginTop: 14 }}>
                  <summary>Ver números de serie ({serials.length})</summary>
                  <ul className="stock-serials">
                    {serials.map((s) => (
                      <li key={s.id}>
                        {s.serialNumber} — {s.status === 'IN_STOCK' ? 'en stock' : 'enviado'}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          ) : (
            <section className="card">
              <h3>Stock</h3>
              <p className="hint" style={{ margin: 0 }}>
                El stock se carga después de crear el producto, agregando un número de serie por
                cada unidad que ingresa.
              </p>
            </section>
          )}
        </div>
      </div>

      <div className="form-actions-bar">
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
