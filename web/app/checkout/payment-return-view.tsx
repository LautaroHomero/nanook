'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { resolvePaymentReturn } from '@/lib/api';
import { useCart } from '@/lib/cart-context';

type ReturnMode = 'success' | 'pending' | 'failure';

const STATUS_COPY: Record<
  ReturnMode,
  {
    heading: string;
    loading: string;
    approved: string;
    pending: string;
    rejected: string;
    fallbackHref: string;
    fallbackLabel: string;
  }
> = {
  success: {
    heading: 'Pago aprobado',
    loading: 'Confirmando tu pago...',
    approved: 'Tu pago fue confirmado correctamente.',
    pending: 'Mercado Pago todavía lo tiene en revisión.',
    rejected: 'Mercado Pago devolvió un estado rechazado o cancelado.',
    fallbackHref: '/',
    fallbackLabel: 'Volver al catálogo',
  },
  pending: {
    heading: 'Pago en revisión',
    loading: 'Consultando el estado del pago...',
    approved: 'El pago ya fue acreditado.',
    pending: 'Tu pago sigue pendiente de confirmación.',
    rejected: 'El pago fue rechazado o cancelado.',
    fallbackHref: '/',
    fallbackLabel: 'Volver al catálogo',
  },
  failure: {
    heading: 'Pago no completado',
    loading: 'Consultando el estado del pago...',
    approved: 'El pago terminó aprobado, aunque la vuelta llegó por failure.',
    pending: 'El pago quedó pendiente.',
    rejected: 'La operación fue rechazada o cancelada.',
    fallbackHref: '/checkout',
    fallbackLabel: 'Volver al checkout',
  },
};

function normalizeStatus(status?: string | null) {
  const value = status?.toLowerCase();
  if (value === 'approved') {
    return value;
  }
  if (
    value === 'pending' ||
    value === 'in_process' ||
    value === 'authorized'
  ) {
    return 'pending';
  }
  if (
    value === 'rejected' ||
    value === 'cancelled' ||
    value === 'refunded' ||
    value === 'charged_back'
  ) {
    return 'rejected';
  }
  return 'pending';
}

function extractPaymentId(params: URLSearchParams) {
  return params.get('payment_id') ?? params.get('collection_id') ?? params.get('id') ?? '';
}

export function PaymentReturnView({ mode }: { mode: ReturnMode }) {
  const params = useSearchParams();
  const { clear } = useCart();
  const [status, setStatus] = useState<'loading' | 'approved' | 'pending' | 'rejected'>('loading');
  const [orderId, setOrderId] = useState<string | null>(
    params.get('orderId') ?? params.get('external_reference'),
  );
  const [paymentId, setPaymentId] = useState<string>(extractPaymentId(params));
  const [verification, setVerification] = useState<{
    verified: boolean;
    finalizeError: string | null;
    amountMatches: boolean | null;
    expectedAmount: number | null;
    remoteAmount: number | null;
    localOrderStatus: string | null;
    localPaymentStatus: string | null;
    preferenceId: string | null;
  } | null>(null);
  const copy = STATUS_COPY[mode];

  useEffect(() => {
    const nextOrderId = params.get('orderId') ?? params.get('external_reference');
    const nextPaymentId = extractPaymentId(params);
    const nextPreferenceId = params.get('preference_id');
    const nextStatus =
      params.get('status') ?? params.get('collection_status') ?? params.get('payment_status');
    setOrderId(nextOrderId);
    setPaymentId(nextPaymentId);

    let active = true;

    async function resolveStatus() {
      try {
        const result = await resolvePaymentReturn({
          paymentId: nextPaymentId || null,
          orderId: nextOrderId || null,
          preferenceId: nextPreferenceId || null,
          status: nextStatus || null,
        });

        if (!active) return;

        setVerification({
          verified: result.verified,
          finalizeError: result.finalizeError ?? null,
          amountMatches: result.amountMatches,
          expectedAmount: result.expectedAmount,
          remoteAmount: result.remoteAmount,
          localOrderStatus: result.localOrderStatus,
          localPaymentStatus: result.localPaymentStatus,
          preferenceId: result.preferenceId,
        });

        if (result.orderId && result.orderId !== nextOrderId) {
          setOrderId(result.orderId);
        }

        const resolvedStatus = normalizeStatus(result.status);
        const approved =
          resolvedStatus === 'approved' ||
          result.localOrderStatus === 'PAID' ||
          result.localPaymentStatus === 'approved';
        const rejected =
          resolvedStatus === 'rejected' || result.localOrderStatus === 'CANCELLED';

        if (approved && result.verified && !result.finalizeError) {
          clear();
          setStatus('approved');
          return;
        }

        if (rejected) {
          setStatus('rejected');
          return;
        }

        setStatus('pending');
      } catch {
        if (!active) return;
        setStatus(mode === 'failure' ? 'rejected' : 'pending');
      }
    }

    resolveStatus();

    return () => {
      active = false;
    };
  }, [clear, mode, params]);

  const message = useMemo(() => {
    if (status === 'approved') return copy.approved;
    if (status === 'pending') return copy.pending;
    return copy.rejected;
  }, [copy, status]);

  const verificationMessage = useMemo(() => {
    if (!verification) return null;
    if (verification.finalizeError) return verification.finalizeError;
    if (verification.amountMatches === false) return 'El monto devuelto por Mercado Pago no coincide con la orden.';
    if (!verification.verified) return 'No pudimos verificar completamente la coincidencia entre MP y la orden local.';
    return null;
  }, [verification]);

  return (
    <div>
      <h1>{copy.heading}</h1>
      {status === 'loading' && <p>{copy.loading}</p>}
      {status !== 'loading' && <p>{message}</p>}
      {verificationMessage && <p>{verificationMessage}</p>}
      {paymentId && <p>Pago: {paymentId}</p>}
      {orderId && <p>Orden: {orderId}</p>}
      {verification?.preferenceId && <p>Preferencia: {verification.preferenceId}</p>}
      <Link href={copy.fallbackHref}>{copy.fallbackLabel}</Link>
    </div>
  );
}
