export const SHIPMENT_STATUSES = ['pending', 'preparing', 'shipped', 'delivered'] as const;

export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente de preparar',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
};

export const SHIPMENT_STATUS_BADGE: Record<string, string> = {
  pending: 'badge-gray',
  preparing: 'badge-yellow',
  shipped: 'badge-green',
  delivered: 'badge-green',
};
