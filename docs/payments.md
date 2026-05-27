# Payments — Operator Guide

This is the runbook for getting end-to-end payments working in production
after the code changes that just landed. Everything below has to happen
**outside the codebase** — either in the Stripe dashboard, in Firestore, or
in env files.

## 1. Stripe dashboard configuration

### Enable Stripe Connect (Express)
1. Dashboard → **Settings → Connect** → enable the platform if not already.
2. Choose **Express** as the connected-account type.
3. Set the platform's branding (used on seller onboarding pages).

### Configure the webhook
1. Dashboard → **Developers → Webhooks** → "Add endpoint".
2. URL: `https://<region>-<project>.cloudfunctions.net/handleStripeWebhook`
   (in this project: `europe-west1`, see `functions/src/index.ts`).
3. Subscribe to **these events** (the new handler expects them):
   - `payment_intent.amount_capturable_updated` ← buyer card authorized
   - `payment_intent.succeeded`                  ← funds captured
   - `payment_intent.payment_failed`             ← restore stock, mark order payment_failed
   - `payment_intent.canceled`                   ← idem
   - `charge.refunded`                           ← writes refund ledger row
4. Copy the **signing secret** (`whsec_...`) — you'll paste it in step 2 below.

## 2. Environment variables

### Next.js (`.env.local`)
Already configured with live keys. Nothing to do here unless you want to swap
to test keys (`pk_test_…` / `sk_test_…`) for development — recommended.

### Firebase Functions (`functions/.env`)
Create this file (it's not in the repo). Required keys:
```
STRIPE_SECRET_KEY=sk_live_...        # same as Next.js .env.local
STRIPE_WH_SECRET=whsec_...           # from step 1
APP_URL=https://marigoapp.com        # used in Connect return URLs
```
Then redeploy: `firebase deploy --only functions`.

## 3. Firestore — platform settings

Open `settings/global` and set:

| Field | Type | Purpose | Default |
|-------|------|---------|---------|
| `commissionRate` | number | Platform fee (0.15 = 15%) | 0.15 |
| `payoutHoldHours` | number | Hours to hold escrow after delivery before auto-capturing and paying out the seller | 72 |
| `refundWindowDays` | number | Days after delivery during which a buyer can request a refund | 14 |

Admin can edit these from the dashboard at `/admin/settings` (verify the
page renders these fields — currently `commissionRate` is wired; the two new
ones may need a quick UI addition).

## 4. Seller onboarding

Each seller has to be onboarded to Stripe Connect before they can receive
payouts. The flow:

1. Seller visits `/profile/stripe-onboarding`.
2. Clicks "Continue to Stripe" → backend creates an Express account, returns
   onboarding URL.
3. Seller fills out KYC on Stripe (bank account, identity, etc.).
4. Stripe redirects back; `users/{uid}.stripeAccountId` is now set.

Sellers without `stripeAccountId` who make a sale will have their payout
flagged as `manual_payout_required` on the order — admin handles that
offline (bank transfer outside Stripe).

## 5. End-to-end money flow (what now actually happens)

```
Buyer pays € X
  │
  ▼ PaymentIntent.create(capture_method: 'manual')
  │ → Stripe authorizes card, holds funds in platform account
  │ → webhook: payment_intent.amount_capturable_updated
  │ → order.status = "processing"
  │
  ▼ (Order ships, gets delivered)
  │ → order.status = "delivered" + deliveredAt timestamp
  │
  ▼ releaseEscrow scheduled job runs hourly
  │ → finds orders delivered > payoutHoldHours ago
  │ → stripe.paymentIntents.capture()
  │ → order.status = "completed"
  │
  ▼ distributeOrderToSellers()
  │ → for each sellerId in order.sellerIds:
  │    sellerNet = (their items × (1 - commissionRate))
  │    stripe.transfers.create({destination: stripeAccountId})
  │    write ledger row in /transactions
  │    order.payouts[sellerId] = { paid, transferId, amount }
  │
  ▼ Seller's connected-account balance now reflects their net
  │
  ▼ Seller hits "Withdraw" on /profile/wallet
    → requestPayout callable → stripe.payouts.create()
    → Funds land in seller's bank account
```

## 6. Refunds

### From admin
1. Admin opens `/admin/orders/[id]` (or `/admin/refunds`).
2. Clicks Refund → can pick full or partial amount.
3. Backend calls `processRefund` cloud function:
   - `stripe.refunds.create({payment_intent})` refunds buyer's card.
   - Webhook `charge.refunded` fires → order marked `refunded`, negative
     ledger row created.
4. **Pending:** the per-seller transfer needs to be **reversed** for the
   refunded amount. This is a follow-up — see `processRefund` and add
   `stripe.transfers.createReversal()` for each `order.payouts[sellerId]`.

### Refund window enforcement
Buyers can only request refunds within `refundWindowDays`. The
buyer-facing button on `/profile/orders/[id]` should hide itself when the
order's `deliveredAt + refundWindowDays * 86400000 < now()`. (UI gate
needs verification — see `src/components/profile/order-actions.tsx` or
the equivalent.)

## 7. What's left to wire up

These are not blockers for accepting payments, but should be addressed
before going live to a real audience:

- [ ] **Defer order creation to webhook** — currently the order is created
  with `pending_payment` before the charge resolves. If Stripe fails the
  charge, the order is still in Firestore (just marked cancelled). To make
  "failed payments never create orders", move the order-creation logic
  from `create-payment-intent` route into the webhook's
  `payment_intent.amount_capturable_updated` handler. The route returns
  only `clientSecret`; the frontend waits for the webhook (poll Firestore
  by paymentIntentId or use a Stripe-redirect with `?payment_intent=...`).
- [ ] **Reverse transfers on refund** — see §6 above.
- [ ] **Admin settings UI** — expose `payoutHoldHours` + `refundWindowDays`
  on `/admin/settings` so they can be edited without touching Firestore
  directly.
- [ ] **`/admin/orders/[id]` refund button** — wire to `processRefund`.
- [ ] **Connect dashboard link** — let sellers open their Stripe Express
  dashboard (`stripe.accounts.createLoginLink`) so they can see payouts
  history natively.
- [ ] **Webhook idempotency log** — store processed Stripe event IDs to
  avoid double-processing on retry. Add a `webhookEvents/{eventId}`
  Firestore doc and short-circuit if already seen.

## 8. Testing locally

1. Switch `.env.local` to test keys (`pk_test_…`, `sk_test_…`).
2. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`.
3. Forward webhooks: `stripe listen --forward-to http://localhost:5001/<project>/europe-west1/handleStripeWebhook`.
4. Use the test signing secret from the CLI output as `STRIPE_WH_SECRET`
   in `functions/.env`.
5. Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995`
   (insufficient funds — triggers `payment_failed`).

When a card fails:
- Order is marked `payment_failed`, stock is restored, no transfer happens.

When a card succeeds and the order eventually completes:
- Funds are captured to platform.
- Each seller receives their net via `transfers.create`.
- `transactions` collection has one `sale` row per seller.
- Seller balance (visible on `/profile/wallet`) reflects available funds.
