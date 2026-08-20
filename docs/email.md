# Transactional email

SendGrid, via the v3 REST API. Replaces Mailtrap, whose sender was the shared
`hello@demomailtrap.co` sandbox address — mail from it never reached a real
inbox.

```
src/lib/email/client.ts     transport (fetch, no SDK)
src/lib/email/layout.ts     shared branded shell
src/lib/email/templates.ts  one function per event
src/lib/email/index.ts      the senders you call
```

## Setup

1. **SendGrid → Settings → Sender Authentication.** Either verify a Single
   Sender, or authenticate `marigoapp.com` by adding the CNAME records
   SendGrid gives you. Domain authentication is worth the extra step: it
   removes the "via sendgrid.net" line Gmail shows and materially improves
   deliverability.
2. **Settings → API Keys → Create API Key**, restricted to *Mail Send*.
3. Add to `.env.local`, and to Vercel under Production **and** Preview:

```
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=hello@marigoapp.com
SENDGRID_FROM_NAME=MarigoApp
```

`SENDGRID_FROM_EMAIL` must match a verified sender or every send returns 403.

## Behaviour without a key

Sends are skipped and logged, never thrown. That is deliberate: CI and preview
deploys run with placeholder env, and a mail outage must not fail the checkout
that triggered the receipt. Every sender resolves with `{ ok, skipped, error }`
rather than raising.

## Previewing

```bash
node scripts/preview-emails.mjs
```

Writes every template to `email-previews/` (gitignored) with an index page.
Nothing is sent.

To see how clients really render them — a browser is a poor proxy for Outlook:

```bash
node scripts/preview-emails.mjs --send you@example.com
```

## Templates

| Event | Recipient | Sender function |
|---|---|---|
| Signup | buyer/seller | `sendWelcomeEmail` |
| Password reset | either | `sendPasswordResetMail` |
| Email verification | either | `sendEmailVerification` |
| Order placed | buyer | `sendOrderConfirmation` |
| Order placed | seller | `sendSellerOrderNotification` |
| Order shipped | buyer | `sendOrderShipped` |
| Order delivered | buyer | `sendOrderDelivered` |
| Order cancelled | buyer | `sendOrderCancelled` |
| Refund issued | buyer | `sendRefundIssued` |
| Payout sent | seller | `sendPayoutSent` |
| Listing approved | seller | `sendListingApproved` |
| Listing rejected | seller | `sendListingRejected` |
| Offer received | seller | `sendOfferReceived` |
| Offer accepted | buyer | `sendOfferAccepted` |
| Offer declined | buyer | `sendOfferDeclined` |
| New message | either | `sendMessageNotification` |
| Return requested | seller | `sendReturnRequested` |
| Return resolved | either | `sendReturnResolved` |

## Writing a template

Use the helpers in `layout.ts` — `button()`, `detailRows()`, `highlight()` —
rather than raw markup. Email clients are not browsers: Outlook renders with
Word, so the shell is nested tables with inline styles, no external CSS and no
web fonts. It looks dated as source and renders everywhere.

**Escape every interpolated value** with `escapeHtml()`. Product titles and
rejection reasons are user-supplied, and land in someone else's inbox.

Amounts are formatted in EUR by `money()`, because EUR is what every amount is
*stored* in. The site displays ALL by converting at read time, but an email is
a record of a transaction — a converted figure would disagree with the Stripe
receipt and the finance dashboard.

## Currently wired

`sendOrderConfirmation` and `sendSellerOrderNotification` fire from
`/api/create-order` and `/api/create-payment-intent`; `sendPasswordResetMail`
from `/api/forgot-password`. The remaining templates are implemented, tested
and ready — their trigger points (status transitions, offer actions, listing
moderation) still need wiring where those events are handled.
