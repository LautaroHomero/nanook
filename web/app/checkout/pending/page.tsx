'use client';

import Link from 'next/link';

export default function CheckoutPendingPage() {
  return (
    <div>
      <h1>Pago en revisión</h1>
      <p>Tu pago está pendiente de confirmación.</p>
      <Link href="/">Volver al catálogo</Link>
    </div>
  );
}
