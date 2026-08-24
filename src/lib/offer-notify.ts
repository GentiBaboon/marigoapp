'use client';

/**
 * Client half of offer email. The SendGrid key cannot be in the browser
 * bundle, so the browser asks the server to send; the server re-reads the
 * offer with the caller's token rather than trusting anything sent here.
 *
 * Fire-and-forget by contract — a mail failure must never surface to the user
 * as a failed offer, in the same way the senders in `src/lib/email` never
 * throw at their call sites.
 */
export type OfferEmailEvent = 'created' | 'accepted' | 'declined' | 'countered';

export async function notifyOfferEmail(
  user: { getIdToken: () => Promise<string> } | null | undefined,
  body: { productId: string; offerId: string; event: OfferEmailEvent },
): Promise<void> {
  if (!user) return;
  try {
    const token = await user.getIdToken();
    await fetch('/api/offers/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[offer] notification email failed:', err);
  }
}
