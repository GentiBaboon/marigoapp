/**
 * Single source of truth for order status semantics:
 * - canonical statuses
 * - linear progress rank
 * - audience-aware display labels (buyer / seller / admin)
 * - allowed transitions per actor
 *
 * `processing` is kept as a legacy alias for `confirmed` so historical orders
 * still render correctly without a data migration.
 */

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'processing' // legacy — treated as confirmed
  | 'in_preparation'
  | 'prepared'
  | 'shipped'
  | 'completed'
  | 'cancel_requested'
  | 'refund_requested'
  | 'cancelled'
  | 'refunded';

export type Audience = 'buyer' | 'seller' | 'admin';

/** Higher = further along the happy path. Off-path values use -1. */
export const STATUS_RANK: Record<string, number> = {
  pending_payment: 0,
  confirmed: 1,
  processing: 1, // legacy alias
  in_preparation: 2,
  prepared: 3,
  shipped: 4,
  completed: 5,
  cancel_requested: 1,
  refund_requested: 4,
  cancelled: -1,
  refunded: -1,
};

const LABELS: Record<string, Record<Audience, string>> = {
  pending_payment: {
    buyer: 'Awaiting payment',
    seller: 'Awaiting payment',
    admin: 'Pending Payment',
  },
  confirmed: {
    buyer: 'Order Confirmed',
    seller: 'Order Confirmed',
    admin: 'Confirmed',
  },
  processing: {
    buyer: 'Order Confirmed',
    seller: 'Order Confirmed',
    admin: 'Confirmed',
  },
  in_preparation: {
    buyer: 'Order In Preparation',
    seller: 'Order In Preparation',
    admin: 'In Preparation',
  },
  prepared: {
    buyer: 'Order Prepared',
    seller: 'Order Prepared',
    admin: 'Prepared',
  },
  shipped: {
    buyer: 'On its way',
    seller: 'Shipped',
    admin: 'Shipped',
  },
  completed: {
    buyer: 'Order Completed',
    seller: 'Waiting for Payment',
    admin: 'Completed',
  },
  cancel_requested: {
    buyer: 'Cancellation Requested',
    seller: 'Cancellation Requested',
    admin: 'Cancellation Requested',
  },
  refund_requested: {
    buyer: 'Refund Requested',
    seller: 'Refund Requested',
    admin: 'Refund Requested',
  },
  cancelled: { buyer: 'Cancelled', seller: 'Cancelled', admin: 'Cancelled' },
  refunded: { buyer: 'Refunded', seller: 'Refunded', admin: 'Refunded' },
};

export function statusLabel(status: string, audience: Audience): string {
  const row = LABELS[status];
  if (row) return row[audience];
  // Fallback: humanize unknown statuses.
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** What the seller can do next from the current status. */
export function nextSellerTransition(
  status: string,
): { status: OrderStatus; label: string } | null {
  switch (status) {
    case 'confirmed':
    case 'processing':
      return { status: 'in_preparation', label: 'Start preparation' };
    case 'in_preparation':
      return { status: 'prepared', label: 'Mark as prepared' };
    case 'prepared':
      return { status: 'shipped', label: 'Mark as shipped' };
    default:
      return null;
  }
}

/** What an admin can do next from the current status (forward progress only). */
export function nextAdminTransition(
  status: string,
): { status: OrderStatus; label: string } | null {
  switch (status) {
    case 'shipped':
      return { status: 'completed', label: 'Mark as completed' };
    default:
      return null;
  }
}

/** Steps shown on a 5-step timeline, ordered. */
export const TIMELINE_STEPS: OrderStatus[] = [
  'confirmed',
  'in_preparation',
  'prepared',
  'shipped',
  'completed',
];

export function stepState(
  currentRank: number,
  stepRank: number,
): 'completed' | 'current' | 'upcoming' {
  if (currentRank > stepRank) return 'completed';
  if (currentRank === stepRank) return 'current';
  return 'upcoming';
}
