import { getProducts } from '@/lib/api';
import ProductCard from './product-card';
import ProductSearch from './product-search';

export default async function HomePage() {
  const products = await getProducts().catch(() => []);

  if (products.length === 0) {
    return (
      <div className="empty-state">
        <p className="eyebrow">Pedalboard vacío</p>
        <p>Todavía no hay productos cargados.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-heading">
        <h1>Catálogo</h1>
      </div>
      <ProductSearch initial={products} />
    </div>
  );
}