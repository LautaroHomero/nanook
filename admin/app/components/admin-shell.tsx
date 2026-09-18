'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '@/lib/api';

type IconName = 'box' | 'cart' | 'search' | 'bell' | 'truck' | 'undo' | 'logout';

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'box':
      return (
        <svg {...common}>
          <path d="M21 8 12 3 3 8l9 5 9-5Z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      );
    case 'cart':
      return (
        <svg {...common}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      );
    case 'truck':
      return (
        <svg {...common}>
          <rect x="1" y="3" width="15" height="13" rx="1" />
          <path d="M16 8h4l3 3v5h-7V8Z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...common}>
          <path d="M3 7v6h6" />
          <path d="M3 13a9 9 0 1 0 3-7.7L3 7" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
  }
}

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/productos', label: 'Productos', icon: 'box' },
  { href: '/pedidos', label: 'Ventas', icon: 'cart' },
  { href: '/solicitudes', label: 'Pedidos de producto', icon: 'search' },
  { href: '/avisos', label: 'Avisos de stock', icon: 'bell' },
  { href: '/envios', label: 'Envíos', icon: 'truck' },
  { href: '/devoluciones', label: 'Devoluciones', icon: 'undo' },
];

export default function AdminShell({
  title,
  onRefresh,
  refreshing,
  children,
}: {
  title: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Nanook <span>Admin</span>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className="secondary"
            onClick={() => {
              clearToken();
              router.push('/login');
            }}
          >
            <Icon name="logout" />
            Salir
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-topbar">
          <h1>{title}</h1>
          {onRefresh && (
            <button className="secondary" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
