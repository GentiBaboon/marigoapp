'use client';

import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore';
import type { FirestoreNotification } from '@/lib/types';

type NotifyArgs = {
  firestore: Firestore;
  userId: string;
  title: string;
  message: string;
  type?: FirestoreNotification['type'];
  link?: string;
  imageUrl?: string;
};

/**
 * Write a notification document. Failures are swallowed (best-effort) so a
 * non-critical permission error never blocks the underlying mutation that
 * triggered it.
 */
export function notifyUser({ firestore, userId, title, message, type = 'order_update', link, imageUrl }: NotifyArgs) {
  if (!firestore || !userId) return;
  return addDoc(collection(firestore, 'notifications'), {
    userId,
    title,
    message,
    type,
    read: false,
    createdAt: serverTimestamp(),
    data: link || imageUrl ? { link, imageUrl } : undefined,
  }).catch(() => null);
}

/** Convenience wrapper for order-status changes. */
export function notifyOrderStatus(args: {
  firestore: Firestore;
  userId: string;
  orderNumber: string;
  status: string;
  link: string;
  audience: 'buyer' | 'seller';
}) {
  const { firestore, userId, orderNumber, status, link, audience } = args;
  const human = humanReadableStatus(status);
  const title = audience === 'buyer' ? `Order #${orderNumber} — ${human}` : `Sale #${orderNumber} — ${human}`;
  const message =
    audience === 'buyer'
      ? `Your order is now ${human.toLowerCase()}.`
      : `Order is now ${human.toLowerCase()}.`;
  return notifyUser({ firestore, userId, title, message, type: 'order_update', link });
}

export function humanReadableStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
