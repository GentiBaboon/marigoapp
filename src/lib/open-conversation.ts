'use client';

import type { User } from 'firebase/auth';

/**
 * Open the buyer↔seller thread for an order or listing, creating it once.
 *
 * Both "Contact seller" (buyer's order page) and "Contact buyer" (seller's
 * sale page) come here, so the two sides cannot drift into separate threads
 * about the same item. `/api/start-conversation` is symmetric: it looks for a
 * conversation on this product that both parties are already in, and only
 * creates one when there is none.
 *
 * Returns the conversation id. Throws with a message worth showing — the
 * route refuses a banned or unverified caller, and the buttons that call this
 * should say so rather than doing nothing, which is what they did before.
 */
export async function openConversation(
  user: User | null | undefined,
  args: { productId: string; otherUserId: string; productTitle?: string; productImage?: string },
): Promise<string> {
  if (!user) throw new Error('Sign in to send a message.');
  if (!args.productId || !args.otherUserId) throw new Error('This order has no item to discuss.');

  const token = await user.getIdToken();
  const res = await fetch('/api/start-conversation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      productId: args.productId,
      otherUserId: args.otherUserId,
      productTitle: args.productTitle ?? '',
      productImage: args.productImage ?? '',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.conversationId) {
    throw new Error(data?.error || 'Could not open the conversation.');
  }
  return data.conversationId as string;
}
