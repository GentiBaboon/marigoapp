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

/**
 * Whether sellers are asked to connect a Stripe payout account.
 *
 * Switched off on 2026-09-15, when payouts became a bank transfer an operator
 * makes by hand (`src/lib/payouts.ts`): the buyer pays the courier in cash,
 * the money reaches Marigo, and the seller requests a transfer from their
 * wallet. Connect onboarding asks for documents and a bank account for a rail
 * that moves nothing today, and it appeared as a "Setup Payouts" step sellers
 * reasonably believed they had to finish before they could be paid.
 *
 * Read in two places, for the same reason the card flag is:
 * - `/profile/stripe-onboarding` sends the seller to their wallet instead.
 * - `/api/stripe/create-connected-account` refuses with 403 — the UI is not
 *   the guard, anyone can call the route directly.
 *
 * Nothing is deleted. The page, the route and the `createStripeConnectedAccount`
 * function all still build, so flipping this back on restores the flow.
 */
export const STRIPE_ONBOARDING_ENABLED = false;
