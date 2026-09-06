'use client';

/**
 * Client half of the order status emails. The browser writes the status under
 * Firestore rules, then asks the server to mail the buyer; the server re-reads
 * the order with this same token and refuses unless the order really is in
 * that status (see `/api/orders/notify`).
 *
 * Fire-and-forget by contract: a mail failure must never surface as a failed
 * status change. Call it with every transition — the route answers "skipped"
 * for the ones that carry no email.
 */
export async function notifyOrderEmail(
  user: { getIdToken: () => Promise<string> } | null | undefined,
  body: { orderId: string; status: string },
): Promise<void> {
  if (!user) return;
  try {
    const token = await user.getIdToken();
    await fetch('/api/orders/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[order-notify] failed:', err);
  }
}
