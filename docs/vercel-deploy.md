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
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | build | **`auth.marigoapp.com`** (§2b); the default `<project>.firebaseapp.com` breaks Google/Apple sign-in on iPhone |
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
| `SITE_URL` | build | **`https://www.marigoapp.com`** — or leave unset, the code falls back to it. Drives every canonical, the sitemaps and `robots.txt`. Do **not** set `https://www.marigo.app`: that domain does not resolve, and pointing this at it makes every canonical URL reference a dead host. |

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

## 2b. Google / Apple sign-in on iPhone (authDomain on our own host)

On iPhone the popup is blocked, so social sign-in falls back to a full-page
redirect through the `authDomain`. With the default `<project>.firebaseapp.com`
that is a third-party origin, and Safari's storage partitioning stops the
handler passing the result back: the user picks their Google account and
lands on the sign-in page again. The fix is an `authDomain` on our own
registrable domain, and **the live one is `auth.marigoapp.com`** (since
2026-09-11): a custom domain on the project's Firebase Hosting site, so
Firebase serves `/__/auth/*` there itself and Vercel is not involved. Safari
partitions by registrable domain, and `auth.marigoapp.com` shares
`marigoapp.com` with the site, so the round trip is first-party.

What it took, and what to check if sign-in breaks:

1. **Firebase → Hosting → Add custom domain** → `auth.marigoapp.com`, with the
   DNS records it asks for. Once it verifies,
   `https://auth.marigoapp.com/__/auth/handler` answers 200 with Firebase's
   page (the site root answers Firebase's "Site Not Found" — expected, nothing
   is deployed there and nothing should be). Adding it here also puts it in
   **Authentication → Settings → Authorized domains** — confirm it is listed.
2. **Google Cloud Console → APIs & Services → Credentials** → the OAuth 2.0
   client Firebase created ("Web client (auto created by Google Service)") →
   **Authorised redirect URIs** → `https://auth.marigoapp.com/__/auth/handler`.
   Without this Google answers `redirect_uri_mismatch` the moment the env
   flips.
3. **Apple Developer → Services ID** used for Sign in with Apple → Return URLs →
   the same `https://auth.marigoapp.com/__/auth/handler`. (The Apple button is
   currently not rendered; do this before it comes back.)
4. **Vercel → Environment Variables** → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` =
   `auth.marigoapp.com` → **redeploy** (it is inlined at build time).

Do steps 1–3 **before** step 4. `next.config.js` reads the same variable into
the CSP's `frame-src`: the handler runs in a hidden iframe from the
`authDomain`, and the wildcard there only matches `*.firebaseapp.com`, so a
host missing from the env would be framed and blocked with no visible error.

**Fallback.** `next.config.js` also proxies `/__/auth/*` on the site itself to
`https://<project>.firebaseapp.com/__/auth/*` (Firebase's other documented
option). Setting the env to `www.marigoapp.com` — with
`https://www.marigoapp.com/__/auth/handler` in the same two console lists —
works as well, without the custom hosting domain.

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
