# Payments Integration — Status & Next Steps

_Last updated: 2026-05-27_

## ✅ Completed

| Area | What's done |
|------|-------------|
| **Code** | All payment, payout, refund logic is built and typechecks cleanly. Per-seller transfer split, configurable hold/refund windows, webhook handlers for success/fail/refund/capture events, idempotent transfers, ledger writes. |
| **Deployment** | All 10 cloud functions deployed to `marigoappcom-v10-6377709-d8775` (europe-west1). |
| **Secrets** | `STRIPE_SECRET_KEY`, `STRIPE_WH_SECRET`, `APP_URL` set in Google Secret Manager and bound to each function. |
| **Stripe sandbox** | Connected. Account `acct_1TZuudCAR95HnxEq`. Test mode keys live in env. |
| **Stripe Connect** | Express platform enabled on the sandbox. |
| **Stripe webhook endpoint** | Registered in Stripe dashboard pointing to `https://handlestripewebhook-onno4to5oa-ew.a.run.app`. Subscribed to 5 events: `payment_intent.amount_capturable_updated`, `.succeeded`, `.payment_failed`, `.canceled`, `charge.refunded`. |
| **Seller onboarding** | Works end-to-end (via Next.js `/api/stripe/create-connected-account` route — bypasses the org policy issue below). Test user's `stripeAccountId = acct_1TbIrgFhRlQ1HNtg` is saved to PROD Firestore. |
| **Platform settings** | `commissionRate = 15%`, `payoutHoldHours = 1`, `refundWindowDays = 1` set in PROD `settings/global`. |

## 🚫 Blocked — Org policy `iam.allowedPolicyMemberDomains`

**Symptom:** any attempt to grant `allUsers` invoker on a cloud function returns:

> `One or more users named in the policy do not belong to a permitted customer, perhaps due to an organization policy.`

**Effect:** Stripe webhooks cannot reach `handleStripeWebhook`. Firebase Hosting rewrites also fail (same IAM block).

**Confirmed:** `curl POST https://marigoappcom-v10-6377709-d8775.web.app/api/stripe/webhook` returns HTTP 403 (the rewrite is in place; Hosting's own service account is also blocked).

## 📝 Support ticket template

File at https://cloud.google.com/support/ or via the **Help → Send feedback / contact support** menu inside your GCP console.

```
Title: Cannot add allUsers as Cloud Functions invoker — org policy block

Project ID: marigoappcom-v10-6377709-d8775
Project number: 329665870351

Request: Please disable the constraint
`constraints/iam.allowedPolicyMemberDomains` (Domain Restricted Sharing) at
the project level, OR add allUsers to its allowed-values list, OR explain
the proper way to grant Cloud Functions v2 public invocation given this
constraint.

Context:
- We need to expose two Cloud Functions to the public internet:
  1. handleStripeWebhook — receives signed webhook callbacks from Stripe
  2. (optional) other callable functions invoked from a browser SPA
- We've tried `gcloud functions add-invoker-policy-binding ... --member=allUsers`
  on all 10 deployed functions. All return:
  "One or more users named in the policy do not belong to a permitted
   customer, perhaps due to an organization policy."
- We've also tried Firebase Hosting rewrites to invoke the function via
  the Hosting service account — same IAM block.
- The constraint isn't visible/editable from the IAM → Organization
  Policies page with our account's permissions.

Region: europe-west1
Cloud Functions runtime: Node.js 20 (2nd Gen)
```

## ⏭️ What to do once the org policy is unblocked

1. Re-run the invoker grant:
   ```bash
   for fn in updateOrderStatus createPaymentIntent createOrder handleStripeWebhook capturePayment processRefund createStripeConnectedAccount sendPasswordResetLink getSellerBalance requestPayout; do
     gcloud functions add-invoker-policy-binding "$fn" \
       --region=europe-west1 \
       --member=allUsers
   done
   ```

2. Test the webhook is reachable:
   ```bash
   curl -X POST https://handlestripewebhook-onno4to5oa-ew.a.run.app \
     -H "stripe-signature: t=1234567890,v1=invalid" \
     -d '{}'
   ```
   Expected: HTTP 400 with body containing "Webhook Error: signature verification failed" (proves the function is invoked and is verifying — just our fake signature is invalid).

3. **Run a real test purchase** end-to-end:
   - Open localhost:3001, add a product to cart, checkout
   - Pay with test card `4242 4242 4242 4242`
   - Verify Stripe dashboard shows the charge
   - Verify Firestore order doc moves `pending_payment` → `processing`
   - (After `payoutHoldHours = 1`, the scheduled `releaseEscrow` captures it)
   - Verify `transactions` collection has a `sale` row with seller's net
   - Verify `users/{sellerUid}.payouts[orderId]` is set

4. Once verified, switch from test keys to live keys:
   - Stripe Dashboard → "View test data" toggle OFF → grab live `sk_live_…` / `pk_live_…`
   - Update `.env.local` (browser side) and `firebase functions:secrets:set STRIPE_SECRET_KEY` (server side)
   - Set up a live webhook endpoint with the same 5 events
   - Update `STRIPE_WH_SECRET` to the live webhook secret
   - Redeploy: `firebase deploy --only functions`

## 🧪 What you CAN test right now (without webhook)

Without webhook delivery, the order doesn't auto-update post-payment, but the payment flow itself works:

1. Add a product to cart, go to checkout
2. Pay with `4242 4242 4242 4242`
3. Verify in Stripe Dashboard → **Payments** that the PaymentIntent was created and authorized (with `capture_method: manual`)
4. Verify in PROD Firestore that an order doc was created in `orders/` with `status: pending_payment` and a `paymentIntentId`

That proves: cart → payment intent → order creation works. Only the post-payment auto-status update is blocked.

## Files changed during this session

- `src/lib/types.ts` — added `payoutHoldHours`, `refundWindowDays` to `FirestoreSettings`
- `functions/src/index.ts` — added `distributeOrderToSellers()`, secret bindings, baseUrl fallback, set/merge on user docs, configurable escrow, expanded webhook events
- `src/firebase/functions.ts` — new client helper; emulator is now opt-in via `NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR=1`
- `src/app/profile/stripe-onboarding/page.tsx` — calls Next.js route instead of cloud function
- `src/app/api/stripe/create-connected-account/route.ts` — new Next.js endpoint for Connect onboarding (bypasses org policy)
- `next.config.js` — CSP whitelists emulator URLs in dev
- `firebase.json` — emulator ports, Hosting rewrite (will work once org policy unblocked)
- `firebase-hosting/index.html` — placeholder for Hosting deploy
- `functions/.env.local` — local Stripe creds (no longer uploaded to deploy)
- 60+ pre-existing TypeScript errors fixed across various files
