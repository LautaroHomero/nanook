'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { confirmOrderPayment } from '@/lib/api';

function CheckoutSuccessContent() {
  const params = useSearchParams();
  const orderId = params.get('orderId');
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');

  useEffect(() => {
    if (!orderId) {
      setStatus('error');
      return;
    }

    confirmOrderPayment(orderId)
      .then(() => setStatus('done'))
      .catch(() => setStatus('error'));
  }, [orderId]);

  return (
    <div>
      <h1>Pago aprobado</h1>
      {status === 'loading' && <p>Confirmando tu pago...</p>}
      {status === 'done' && (
        <>
          <p>Tu pago fue confirmado correctamente.</p>
          <p>Orden: {orderId}</p>
          <Link href="/">Volver al catálogo</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <p>No pudimos confirmar tu pago en este momento.</p>
          <Link href="/">Volver al catálogo</Link>
        </>
      )}
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<p>Procesando tu pago...</p>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
