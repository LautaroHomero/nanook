import { getProduct } from '@/lib/api';
import AddToCartButton from './add-to-cart-button';
import Image360 from '../image-360';

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id);
  const hayStock = product.stock > 0;

  return (
    <div>
      <h1>{product.name}</h1>
      {product.images && product.images.length > 0 && (
        <Image360 images={product.images} />
      )}
      <p className="price">${product.price}</p>
      <p>{product.description}</p>
      <p>{hayStock ? 'En stock' : 'Sin stock'}</p>
      <AddToCartButton
        productId={product.id}
        name={product.name}
        price={Number(product.price)}
        stock={product.stock}
      />
    </div>
  );
}
