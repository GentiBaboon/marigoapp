/**
 * Which ways of paying the checkout offers.
 *
 * Card payments (new card, saved card, Apple Pay / Google Pay, PayPal) were
 * withdrawn from the live site on 2026-09-08, leaving cash on delivery as the
 * only option "for the moment". One flag, read in three places, so restoring
 * them is a one-line change:
 *
 * - `PaymentStep` hides every non-cash option and preselects cash.
 * - `/api/create-payment-intent` refuses with 403 — the UI is not the guard,
 *   anyone can call the route directly.
 * - The Help Centre and the assistant's knowledge describe the payment
 *   options that actually exist.
 *
 * The Stripe plumbing (escrow, capture, payouts, `docs/payments.md`) is
 * untouched and still deploys.
 */
export const CARD_PAYMENTS_ENABLED = false;
