# CLAUDE.md — MarigoApp (Marigo Luxe Marketplace)

Context document for Claude Code. Keep this in sync with reality when the codebase changes.

## 1. Product summary

**MarigoApp** (`marigoapp`) is a luxury fashion marketplace (C2C) for pre-owned authentic designer items, targeting Albania, Italy, and the wider EU. Buyers discover and purchase curated luxury goods; sellers list items with AI-assisted pricing and descriptions; couriers handle last-mile delivery; admins moderate listings, orders, disputes, refunds, and finance.

Branding: primary purple `#7C3AED`, accent gold `#F59E0B`, off-white `#F4F2F9`; headings Georgia serif, body Inter, logo Poppins 700. See `docs/blueprint.md`.

Site: `https://www.marigo.app` (default HTML lang is `sq` — Albanian).

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, server actions), React 18, TypeScript 5 |
| Styling | Tailwind CSS 3 + `tailwindcss-animate`, shadcn/Radix UI primitives (37 components in `src/components/ui`) |
| Auth / DB | Firebase Auth + Firestore (client SDK v10) |
| Cloud Functions | Firebase Functions v2 (Node 20, region `europe-west1`) |
| Payments | Stripe (`@stripe/react-stripe-js`, server SDK in functions) |
| Image storage | Supabase Storage (two buckets: `degobqannokhholahyif`, `gzehidqkvqnwzwrkvist`) + Firebase Storage |
| AI | Genkit + `@genkit-ai/google-genai`, plus Vertex AI in functions |
| Email | Mailtrap |
| Forms | react-hook-form + Zod (single source of truth for validation) |
| State | React Context (`Cart`, `Wishlist`, `Currency`, `Language`) |
| Testing | Vitest + jsdom + Testing Library (unit/component), Playwright (E2E, Chromium) |
| PWA | `next-pwa` (disabled in dev) + `public/manifest.json` + workbox sw |
| Hosting | Firebase App Hosting (`apphosting.yaml`), Vercel config also present (`vercel.json`) |

## 3. Top-level layout

```
/
├── .claude/launch.json          # Dev server & functions emulator launch configs
├── .github/workflows/ci.yml     # Quality (lint/typecheck/test/build) + E2E on PR
├── apphosting.yaml              # Firebase App Hosting
├── firebase.json                # Firestore/Storage/Functions config
├── firestore.rules              # Security rules (see §7)
├── firestore.indexes.json       # Composite indexes
├── storage.rules                # Firebase Storage rules
├── next.config.js               # PWA, CSP, security headers, remote image patterns
├── next-sitemap.config.js       # Sitemap generated postbuild
├── tailwind.config.ts
├── tsconfig.json                # paths: "@/*" → "./src/*"
├── vitest.config.ts             # jsdom env, setup at src/__tests__/setup.ts
├── playwright.config.ts         # baseURL http://localhost:3001
├── vercel.json
├── docs/
│   ├── backend.json
│   └── blueprint.md             # Design/brand spec
├── e2e/                         # admin, auth, home, search specs
├── functions/                   # Firebase Cloud Functions (TS, Node 20)
├── scripts/                     # One-offs (set-admin, set-super-admin, cleanup)
├── public/                      # manifest, icons, og images, sw assets
└── src/
    ├── middleware.ts            # Edge middleware — auth gate + CSRF + headers
    ├── app/                     # Next App Router tree
    ├── ai/                      # Genkit flows
    ├── components/              # Feature + UI components
    ├── context/                 # Cart / Wishlist / Currency / Language providers
    ├── firebase/                # Client SDK init + hooks + provider
    ├── hooks/                   # use-admin-auth, use-courier-auth, use-mobile, etc.
    ├── lib/                     # Shared utilities, types, rate-limit, env, supabase, i18n JSON
    ├── services/                # product, order, user, image-upload services
    └── __tests__/               # Vitest setup + tests
```

## 4. App Router map (`src/app/`)

Public:
- `/` (home), `/about`, `/help`, `/privacy`, `/terms`
- `/browse/[...slug]` — filtered browsing (category/price/etc. via URL params)
- `/search` — search results (smart-search AI flow backs it)
- `/products/[id]` — product detail
- `/(onboarding)/welcome` — first-run flow

Auth (`/auth/*`): `login`, `signup`, `forgot-password`, `reset-password`, `verify-email`.

Authenticated (gated by middleware §6):
- `/profile`, `/profile/addresses`, `/profile/listings`, `/profile/orders`, `/profile/offers`, `/profile/earnings`, `/profile/payments`, `/profile/settings`, `/profile/stripe-onboarding`
- `/sell` — multi-step listing wizard (8 steps in `components/sell/steps`)
- `/cart`, `/checkout` (+ `/checkout/success`)
- `/messages`, `/messages/[conversationId]` — real-time chat
- `/favorites`, `/notifications`

Courier (`/courier/*`, role-gated): `dashboard`, `jobs`, `delivery`, `earnings`, `profile`. Public `/delivery-partner` + `/delivery-partner/apply` funnel.

Admin (`/admin/*`, role-gated — admin/super_admin/moderator/analyst):
`products`, `orders`, `users`, `logistics`, `finance`, `marketing`, `moderation`, `support`, `disputes`, `refunds`, `returns`, `logs`, `settings`.

API routes (`src/app/api/`):
- `ai/generate-description`, `ai/recommendations`, `ai/remove-background`
- `chat` (Genkit chatbot)
- `create-order`, `create-payment-intent` (Stripe)
- `forgot-password`, `start-conversation`, `upload`

## 5. Data model (Firestore)

Main collections (types in `src/lib/types.ts`):

| Collection | Purpose | Key statuses |
|---|---|---|
| `users/{uid}` | Profile, role, KYC, Stripe ids, preferences | `active` / `banned` |
| `users/{uid}/{wishlist,cart,addresses,paymentMethods}` | Subcollections (owner-only) | — |
| `products/{id}` | Listings | `draft`, `pending_review`, `active`, `sold`, `removed`, `expired`, `reserved` |
| `products/{id}/offers/{offerId}` | Buyer→seller offers | `pending`, `accepted`, `rejected`, `expired` |
| `orders/{id}` | Checkout orders (multi-seller via `sellerIds[]`) | `pending_payment`, `processing`, `shipped`, `delivered`, `completed`, `cancelled`, `refunded` |
| `deliveries/{id}` | Courier delivery tasks | `pending_assignment`, `assigned`, `arrived_for_pickup`, `picked_up`, `in_transit`, `arrived_for_delivery`, `delivered`, `cancelled` |
| `courier_profiles/{uid}` | Courier KYC & vehicle info | — |
| `conversations/{id}/messages/{mid}` | Real-time buyer↔seller chat | — |
| `support_chats/{id}/messages/{mid}` | User↔admin support | — |
| `notifications/{id}` | Per-user notifications | `read` flag |
| `reports/{id}` | User-filed reports (moderation) | `pending`, `resolved` |
| `reviews/{id}` | Seller/product reviews | — |
| `refunds/{id}`, `disputes/{id}`, `returns/{id}` | Post-purchase workflows | — |
| `coupons/{id}` | Discount codes (admin-writable, signed-in read) | — |
| `categories`, `brands`, `conditions`, `materials`, `colors`, `patterns` | Catalog metadata (public read) | — |
| `settings/global`, `config/exchangeRates` | Platform config | — |
| `admin_logs/{id}` | Audit trail of admin actions | — |

Roles (`UserRoleEnum`): `buyer`, `seller`, `courier`, `admin`, `super_admin`, `moderator`, `analyst`. Admin checks use Firebase custom claim `admin: true` with Firestore-role fallback (`firestore.rules:20`).

## 6. Security architecture

**Edge middleware (`src/middleware.ts`):**
1. Redirects unauthenticated requests on `/profile`, `/sell`, `/cart`, `/checkout`, `/messages`, `/notifications`, `/favorites`, `/admin/*`, `/courier/*` to `/auth/login?redirect=...`. Looks for `__session` or `marigo_auth` cookie only (full JWT verification happens in each API route server-side).
2. CSRF: double-submit cookie (`__csrf` cookie + `x-csrf-token` header) required on `POST/PUT/PATCH/DELETE` to `/api/*`, except Bearer-token requests and stateless AI routes (`/api/chat`, `/api/ai/*`).
3. Sets `__csrf` cookie on page responses (not httpOnly so JS can read; SameSite=strict).

**HTTP headers (`next.config.js`):** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS, `X-XSS-Protection`, `Permissions-Policy`, and a strict CSP allowing only Stripe/Firebase/Supabase/Google Analytics/GTM/Mailtrap.

**Firestore rules (`firestore.rules`):** Every collection has explicit rules — no wildcard catch-all. Helpers: `isSignedIn`, `isOwner`, `isAdmin`, `isFullAdmin`, `isCourier`. Orders, refunds, disputes, returns are readable only by involved parties or admins.

**Rate limiting:** `src/lib/rate-limit.ts` (used in API routes).

## 7. AI surface (Genkit)

Flows in `src/ai/flows/`:
- `ai-suggest-price.ts` — seller price suggestion from product details
- `generate-description.ts` — listing description generator
- `get-recommendations.ts` — product recommendations
- `smart-search.ts` — semantic search backing `/search`
- `remove-background.ts` — product-image background removal
- `ai-chat.ts` — chatbot used by `components/ai/ChatbotWidget` (lazy-loaded in `src/app/layout.tsx`)

Genkit entry: `src/ai/genkit.ts`. Server models configured via `GOOGLE_GENAI_API_KEY`. Functions additionally use `@google-cloud/vertexai`.

## 8. Payments

- Client: `@stripe/react-stripe-js` + Stripe Elements in `components/checkout/payment-step.tsx`.
- API: `src/app/api/create-payment-intent/route.ts`, `src/app/api/create-order/route.ts`.
- Cloud Functions (`functions/src/index.ts`) handle post-payment side-effects: `updateOrderStatus` marks products `sold` / releases on refund, fans out notifications, etc. Region `europe-west1`.
- Sellers onboard via Stripe Connect (`/profile/stripe-onboarding`).

## 9. Frontend patterns

- Path alias `@/*` → `src/*`.
- Forms: React Hook Form + `zodResolver`; schemas live with their types in `src/lib/types.ts` (single source of truth).
- Data fetching hooks: `src/firebase/firestore/use-collection.tsx`, `use-doc.tsx`; auth actions in `src/firebase/auth/actions.ts`; provider `FirebaseClientProvider` wraps the app.
- i18n: JSON bundles `src/lib/translations/{en,it,sq}.json` via `LanguageContext`; default locale `sq`.
- Currency: `CurrencyContext` + `config/exchangeRates` doc (EUR base; ALL / USD supported).
- Mobile-first: bottom `MobileNav` (Home/Search/Cart/Favorites/Profile), hidden ≥ md.
- Server actions used in sell flow (`src/app/sell/actions.ts`).
- Error reporting: `src/lib/error-reporter.ts` + `FirebaseErrorListener` mounted globally.

## 10. Commands (from `package.json`)

```
npm run dev         # Next dev on PORT (default 3001)
npm run build       # Production build (also runs next-sitemap in postbuild)
npm run start       # Run built app
npm run lint        # next lint
npm run typecheck   # tsc --noEmit   (CI continue-on-error — pre-existing errors)
npm run test        # Vitest (jsdom) — src/**/*.{test,spec}.{ts,tsx}
npm run test:watch  # Vitest watch
npm run test:e2e    # Playwright against localhost:3001
```

Functions (inside `functions/`): `npm run build` (tsc), `npm run serve` (emulators), `npm run deploy`.

Utility scripts (`scripts/`): `set-admin-role.ts`, `set-super-admin.mjs`, `delete-no-photo-products.{js,mjs}`.

## 11. CI (`.github/workflows/ci.yml`)

- Triggers: push to `main` / `marigoappv1.0`, PRs to `main`.
- `quality` job: install → typecheck (`continue-on-error: true` — known pre-existing TS errors around `FirestoreTimestamp.toDate` and `displayName`) → vitest → `next build` with dummy `NEXT_PUBLIC_FIREBASE_*` env.
- `e2e` job (PRs only, needs `quality`): Playwright with Chromium; uploads `playwright-report/`.

## 12. Environment variables (`.env.example`)

```
NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID / APP_ID / FUNCTIONS_REGION=europe-west1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  + STRIPE_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL / ANON_KEY + SUPABASE_SERVICE_ROLE_KEY
GOOGLE_GENAI_API_KEY
MAILTRAP_TOKEN
RESET_SERVICE_SECRET
```

Functions also read `STRIPE_SK` / `STRIPE_SECRET_KEY` from `functions/.env`.

## 13. Known gotchas

- **TS build errors are currently silenced** (`next.config.js` `typescript.ignoreBuildErrors: true`, `eslint.ignoreDuringBuilds: true`). CI typecheck is `continue-on-error`. Fix before enabling.
- `FirestoreTimestamp.toDate()` type mismatch — use the `toDate()` helper in `src/lib/types.ts` rather than calling `.toDate()` directly.
- Dev server port defaults to **3001** (see `package.json` + `playwright.config.ts`).
- PWA is disabled in dev (`next-pwa` `disable: NODE_ENV === 'development'`).
- Two Supabase image hosts are whitelisted — migration between them may be in progress.
- Middleware does not do full JWT verification at the Edge (Firebase JWKS cost); API routes verify via `verifyIdToken` in `src/lib/firebase-admin.ts`.
- No wildcard Firestore rule — new collections require explicit rules or reads/writes will be denied.

## 14. Branch

Active working branch for docs/context work: `claude/create-marketplace-docs-ng9ho`.
