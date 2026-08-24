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
   deliverability — and it is the only way `no-reply@marigoapp.com` sends
   without verifying that individual mailbox.
2. **Settings → API Keys → Create API Key**, restricted to *Mail Send*.
3. Add to `.env.local`, and to Vercel under Production **and** Preview:

```
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=no-reply@marigoapp.com
SENDGRID_FROM_NAME=Marigo Fashion Marketplace
SENDGRID_REPLY_TO=hello@marigoapp.com
```

`SENDGRID_FROM_EMAIL` must match a verified sender or every send returns 403.

The From is a **no-reply mailbox**, so `client.ts` always attaches a Reply-To
(`SENDGRID_REPLY_TO`, defaulting to `hello@marigoapp.com`). A no-reply From
with nowhere to reply drops customer replies on the floor, and some filters
score it as spam.

## Verifying the configuration

```bash
npm run email:check
```

`scripts/check-email-config.mjs` checks, in the order failures actually bite:
env vars → the key authenticates → the key carries `mail.send` → the From
address is a verified Single Sender **or** its domain is authenticated → the
recipient is not on a bounce / block / spam / unsubscribe list. That last one
matters because a suppressed recipient still gets a `202` — SendGrid accepts
the send and silently drops it, which looks identical to success from the app.

A *Mail Send*-restricted key cannot read most of those endpoints. The script
reports those as warnings, not failures — a restricted key is the recommended
setup. Only real problems exit non-zero.

Pass `--to someone@example.com` to check a different recipient.

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
npm run email:send -- you@example.com
```

Every subject is prefixed `[test]`. Sends are reported per template, and the
script exits non-zero if any failed. **Acceptance is not delivery**: a `202`
means SendGrid took the message, not that it landed. Confirm in the inbox, and
check SendGrid → Activity Feed (filterable by the `category` each template
sets) for what happened after.

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
| **New sign-up** | **admin** | `sendAdminNewUser` |
| **New order** | **admin** | `sendAdminNewOrder` |
| **Order cancelled** | **admin** | `sendAdminOrderCancelled` |

## Admin alerts

Three operational alerts go to `ADMIN_EMAIL` (default `hello@marigoapp.com`)
rather than to a customer. Point it at a staging inbox on non-production
deployments so previews don't page the live one.

Every subject is prefixed `[Admin] ` and every button links into `/admin`, so
the whole stream can be filed by one inbox rule and each alert lands where the
operator can act on it. Categories are `admin-new-user`, `admin-new-order` and
`admin-order-cancelled`.

| Alert | Fires from |
|---|---|
| New sign-up | `FirebaseProvider` — the one point every sign-up path (email, Google, Apple) converges on, when the `users/{uid}` doc is first created. One alert per account, never duplicated. |
| New order | `/api/create-order` and `/api/create-payment-intent`, inline. These already computed the totals, so the alert quotes the figure the buyer was actually charged. |
| Order cancelled | `/api/admin/notify`, from all three surfaces that can cancel: the admin order screen, the orders-table row action, and a dispute resolution. Only on the *transition*, so re-saving an already-cancelled order doesn't mail again. |

`/api/admin/notify` exists because two of the triggers are client-side and the
SendGrid key cannot be in the browser bundle. It takes an event and an id, then
re-reads the record under the **caller's own ID token** — a user may only
announce their own registration, and cancellations require an admin role — so
nothing in the request body reaches the email.

## Unsubscribe

Every email carries an unsubscribe link in its footer, plus the RFC 2369 /
RFC 8058 `List-Unsubscribe` and `List-Unsubscribe-Post` headers that make
Gmail and Yahoo show their own one-click control beside the sender name. Those
headers are now effectively required of bulk senders by both providers.

**The link is signed.** A URL is something anyone can edit, so the recipient's
address is never in the query string in the clear — `src/lib/email/unsubscribe.ts`
mints `<base64url(email)>.<hmac>` and the route refuses anything whose signature
does not verify. Nothing is stored: the token is self-describing, so there is no
table to keep in step with the mail.

Templates don't know their recipient, so the shared shell emits a
`%%UNSUBSCRIBE_URL%%` placeholder and `sendEmail` substitutes a link for the
actual address — before deriving the plain-text part, so both alternatives get a
working link. That is why all 21 templates gained the footer without any of them
being edited.

### What an unsubscribe actually stops

`ESSENTIAL_CATEGORIES` is the list that keeps sending regardless: password
reset, email verification, every order status mail, refunds, payouts, returns
and the admin alerts. Everything else — welcome, offers, new messages, listing
moderation — is silenced.

That split is enforced by a **SendGrid suppression group**. Mail tagged with the
group id is suppressed for anyone who opted out of it; essential mail is sent
with no group and is unaffected. Set `SENDGRID_UNSUBSCRIBE_GROUP_ID` from
Marketing → Unsubscribe Groups.

**With no group configured the route falls back to SendGrid's global
suppression, which stops receipts too.** That fallback is deliberate — a link
that silently did nothing would be worse — but it is not what you want in
production, so configure the group.

The other way round (global unsubscribe plus `bypass_list_management` on the
important mail) was rejected: that flag also bypasses bounce and spam-report
suppression, which is how a sending domain gets itself blocked.

The confirmation page never acts on a GET. Mail clients and security scanners
prefetch links, so an opt-out that fired on page load would unsubscribe people
who never clicked anything.

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

| Sender | Trigger |
|---|---|
| `sendOrderConfirmation`, `sendSellerOrderNotification` | `/api/create-order`, `/api/create-payment-intent` |
| `sendPasswordResetMail` | `/api/forgot-password` |
| `sendOfferReceived`, `sendOfferAccepted`, `sendOfferDeclined` | `/api/offers/notify` |

The offer route mails **the party who did not act**, which is not a fixed side:
a seller accepting the buyer's offer reaches the buyer, but a buyer accepting
the seller's counter reaches the seller. It is called fire-and-forget from the
client because the SendGrid key cannot be in the browser bundle, and it re-reads
the offer under the caller's own ID token rather than trusting the request body.

Still unwired: order shipped/delivered/cancelled, refund, payout, listing
approved/rejected, new message, both returns, welcome and verify-email. They are
implemented and tested — their trigger points just need the same treatment.
