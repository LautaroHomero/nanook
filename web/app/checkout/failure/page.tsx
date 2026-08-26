'use client';

import Link from 'next/link';

export default function CheckoutFailurePage() {
  return (
    <div>
      <h1>Pago no completado</h1>
      <p>La operación fue rechazada o cancelada.</p>
      <Link href="/checkout">Volver al checkout</Link>
    </div>
  );
}
