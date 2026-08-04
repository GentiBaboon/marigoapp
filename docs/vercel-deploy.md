# Deploying Marigo to Vercel

_Last updated: 2026-08-04_

The app is a standard Next.js 14 App Router project and needs no adapter. `vercel.json`
already pins `framework: nextjs` and `regions: ["fra1"]` (Frankfurt — closest to
Albania/EU).

## Why this works without a service account

`src/lib/firebase-admin.ts` is a hand-rolled shim, not the `firebase-admin` SDK. It
verifies ID tokens against Google's public JWKS via `jose` and talks to Firestore over
the REST API using the caller's own ID token. That means **no `GOOGLE_APPLICATION_CREDENTIALS`
and no service account JSON is needed** — it runs on any serverless platform. Nothing
about the API routes has to change for Vercel.

## 1. Environment variables

Set all of these in **Project → Settings → Environment Variables** for the Production
(and Preview) environments.

| Variable | Needed at | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | build | |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | build | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | build + runtime | also used by the REST shim |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | build | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | build | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | build | |
| `NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION` | build | `europe-west1` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | build | |
| `STRIPE_SECRET_KEY` | runtime | |
| `NEXT_PUBLIC_SUPABASE_URL` | **build** | see warning below |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build | |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | |
| `GOOGLE_GENAI_API_KEY` | runtime | |
| `MAILTRAP_TOKEN` | runtime | |
| `RESET_SERVICE_SECRET` | runtime | |
| `SITE_URL` | build | e.g. `https://www.marigo.app`; drives `sitemap.xml` + `robots.txt` |

> **`NEXT_PUBLIC_SUPABASE_URL` must be present at build time.** `next.config.js` parses
> its hostname to build `images.remotePatterns`. If it is missing during the build,
> `next/image` rejects every Supabase-hosted product photo at runtime with a 400.

Anything prefixed `NEXT_PUBLIC_` is inlined into the client bundle at build time, so
changing one requires a **redeploy**, not just a restart.

## 2. Add the Vercel domain to Firebase Auth

This is the step that most often breaks a first deploy. In
**Firebase Console → Authentication → Settings → Authorized domains**, add:

- `<your-project>.vercel.app`
- your custom domain, once attached

Sign-in silently fails on any domain not in that list.

## 3. Firestore rules and indexes

Vercel deploys the frontend only. Rules and indexes still ship through the Firebase CLI:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 4. Stripe webhook — still open

There is **no** Next.js webhook route; only `src/app/api/stripe/create-connected-account`
exists. Webhook handling lives in the `handleStripeWebhook` Cloud Function, which is
currently unreachable because of the `iam.allowedPolicyMemberDomains` org policy
documented in [payments-status.md](payments-status.md).

Worth knowing: moving to Vercel makes that blocker optional. A route at
`src/app/api/stripe/webhook/route.ts` is publicly reachable with no GCP IAM involved,
so the webhook could be pointed at `https://<domain>/api/stripe/webhook` instead of
waiting on the support ticket. That is a payment-path change and is deliberately left
for the next version.

## 5. Deploy

Import the GitHub repo at Vercel, or:

```bash
npx vercel --prod
```

Build command, output directory, and install command are all auto-detected. `postbuild`
runs `next-sitemap` automatically.

## Known gaps at time of writing

- **Gemini quota.** `GOOGLE_GENAI_API_KEY` returns `RESOURCE_EXHAUSTED` (free-tier
  `limit: 0`). AI features degrade gracefully but stay empty until billing is enabled.
- **`sellerIds` backfill.** Older order documents are missing the seller's uid, so
  affected sellers see `Sold (0)` and their order/delivery reads are denied by rules.
- **TypeScript and ESLint errors are suppressed during builds** via `ignoreBuildErrors`
  and `ignoreDuringBuilds` in `next.config.js`. A type error will therefore reach
  production rather than failing the deploy.
