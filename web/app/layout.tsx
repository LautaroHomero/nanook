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
            <PedalboardBadge />
          </header>
          <main className="container">{children}</main>
          <footer className="site-footer">
            <Link href="/pedir-producto" className="cart-link">
              Pedir producto
            </Link>
            <Link href="/devoluciones" className="cart-link">
              Devoluciones
            </Link>
            <a
              href="https://www.instagram.com/tienda.nanook/"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              aria-label="Seguinos en Instagram"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
              </svg>
            </a>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}