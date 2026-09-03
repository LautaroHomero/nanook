import './styles/globals.css';
import Link from 'next/link';
import { CartProvider } from '@/lib/cart-context';
import PedalboardBadge from './pedalboard-badge';

export const metadata = {
  title: 'Nanook',
  description: 'Venta de productos de música y pedales',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <CartProvider>
          <header className="site-header">
            <Link href="/" className="logo">
              <span className="logo-led" aria-hidden="true" />
              Nanook
            </Link>
             <Link href="/pedir-producto" className="cart-link" style={{ marginRight: 12 }}>
                Pedir producto
            </Link>
            <PedalboardBadge />
          </header>
          <main className="container">{children}</main>
        </CartProvider>
      </body>
    </html>
  );
}