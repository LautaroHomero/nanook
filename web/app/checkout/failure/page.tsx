'use client';

import { Suspense } from 'react';
import { PaymentReturnView } from '../payment-return-view';

export default function CheckoutFailurePage() {
  return (
    <Suspense fallback={<p>Procesando tu pago...</p>}>
      <PaymentReturnView mode="failure" />
    </Suspense>
  );
}
