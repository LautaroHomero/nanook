'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { mockConfirmPayment } from '@/lib/api';

function MockPaymentContent() {
  const params = useSearchParams();
  const orderId = params.get('orderId');
  const [status, setStatus] = useState<'idle' | 'done'>('idle');

  return (
    <div>
      <h1>Pago simulado</h1>
      <p>
        Esta pantalla reemplaza el checkout real de Mercado Pago mientras no
        haya credenciales configuradas.
      </p>
      {status === 'idle' ? (
        <button
          onClick={async () => {
            if (orderId) {
              await mockConfirmPayment(orderId);
              setStatus('done');
            }
          }}
        >
          Simular pago aprobado
        </button>
      ) : (
        <p>Pago confirmado. Orden {orderId} marcada como pagada.</p>
      )}
    </div>
  );
}

export default function MockPaymentPage() {
  return (
    <Suspense fallback={<p>Cargando pago simulado...</p>}>
      <MockPaymentContent />
    </Suspense>
  );
}
