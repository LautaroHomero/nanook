import Link from 'next/link';
import { Product } from '@/lib/api';

export default function ProductCard({ product }: { product: Product }) {
  const inStock = product.stock > 0;
  const thumbnail = product.images?.[0];

  return (
    <Link href={`/producto/${product.id}`} className="product-card">
      <div className="stripe" />
      <div className="thumb">
        {thumbnail ? (
          <img src={thumbnail} alt={product.name} loading="lazy" />
        ) : (
          <div className="thumb-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="card-body">
        <div className="knob" aria-hidden="true" />
        <h3>{product.name}</h3>
        <span className="price">${product.price}</span>
      </div>
      <div className="footswitch">
        <span className={`led-dot ${inStock ? 'in-stock' : 'out'}`} />
        {inStock ? 'En stock' : 'Sin stock'}
      </div>
    </Link>
  );
}