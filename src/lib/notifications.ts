'use client';

import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore';
import type { FirestoreNotification } from '@/lib/types';
import { statusLabel, type Audience } from '@/lib/order-status';

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
 * Best-effort notification write. Always resolves — never throws — so callers
 * can fire-and-forget alongside the action that triggered the notification.
 * Strips undefined fields so addDoc doesn't reject on serialization.
 */
export async function notifyUser({ firestore, userId, title, message, type = 'order_update', link, imageUrl }: NotifyArgs) {
  if (!firestore || !userId) return null;
  try {
    const data: Record<string, string> = {};
    if (link) data.link = link;
    if (imageUrl) data.imageUrl = imageUrl;
    const payload: Record<string, unknown> = {
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: serverTimestamp(),
    };
    if (Object.keys(data).length > 0) payload.data = data;
    return await addDoc(collection(firestore, 'notifications'), payload);
  } catch (err) {
    console.warn('[notifyUser] failed', err);
    return null;
  }
}

/** Convenience wrapper for order-status changes. Uses audience-aware labels. */
export function notifyOrderStatus(args: {
  firestore: Firestore;
  userId: string;
  orderNumber: string;
  status: string;
  link: string;
  audience: Audience;
}) {
  const { firestore, userId, orderNumber, status, link, audience } = args;
  const label = statusLabel(status, audience);
  const prefix = audience === 'seller' ? 'Sale' : 'Order';
  const title = `${prefix} #${orderNumber} — ${label}`;
  const message =
    audience === 'buyer'
      ? `Your order is now: ${label}.`
      : audience === 'seller'
        ? `Your sale is now: ${label}.`
        : `Order status: ${label}.`;
  return notifyUser({ firestore, userId, title, message, type: 'order_update', link });
}

export function humanReadableStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
