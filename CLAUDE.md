# CLAUDE.md — MarigoApp (Marigo Luxe Marketplace)

Context document for Claude Code. Keep this in sync with reality when the codebase changes.

## 1. Product summary

**MarigoApp** (`marigoapp`) is a luxury fashion marketplace (C2C) for pre-owned authentic designer items, targeting Albania, Italy, and the wider EU. Buyers discover and purchase curated luxury goods; sellers list items with AI-assisted pricing and descriptions; couriers handle last-mile delivery; admins moderate listings, orders, disputes, refunds, and finance.

**Canonical site: `https://www.marigoapp.com`.** `src/lib/site.ts` (`SITE_URL` / `SITE_NAME` / `absoluteUrl`) is the single source — the old `marigo.app` domain does not resolve, so never hardcode a host. `next-sitemap.config.js` mirrors the same fallback.

Branding (`src/app/globals.css` CSS vars → `tailwind.config.ts`):

| Token | Value | Notes |
|---|---|---|
| `--primary` | `267.6 85% 73.9%` ≈ `#B884F5` | Brand purple. `--primary-foreground` is near-black for contrast (light purple only hits 2.74:1 against white). |
| `--accent` | `40.7 92.5% 54.1%` ≈ `#F59E0B` | Gold |
| `--background` | `0 0% 100%` | White (dark mode swaps to `240 10% 3.9%`) |
| `--ring` | `262.1 83.3% 57.8%` | Focus ring |

Fonts: `font-headline` Georgia serif, `font-body` Inter, `font-logo` Poppins 700. Design spec: `docs/blueprint.md`.

Locale: `<html lang="sq">`, but `LanguageContext` **defaults to `en`** and the picker offers `en` / `sq` only — Italian was pulled from the UI, `it.json` is retained in case it returns.

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2 (App Router, server actions), React 18, TypeScript 5 |
| Styling | Tailwind CSS 3 + `tailwindcss-animate`, shadcn/Radix primitives (37 components in `src/components/ui`), `framer-motion` |
| Auth / DB | Firebase Auth + Firestore (client SDK v10) |
| Server-side token verification | `jose` + Firebase JWKS — **no service-account key**; Firestore writes go through the REST API with the user's ID token (`src/lib/firebase-admin.ts`) |
| Cloud Functions | Firebase Functions v2 (Node 20, region `europe-west1`), `firebase-admin` 12 |
| Payments | Stripe (`@stripe/react-stripe-js` client, `stripe` v21 in Next routes, v16 in functions) + Stripe Connect Express |
| Image storage | Supabase Storage, single bucket `product-images` (`PRODUCT_IMAGES_BUCKET`) + Firebase Storage for user/delivery assets |
| AI | Genkit 1.x + `@genkit-ai/google-genai` (default model `googleai/gemini-2.0-flash`); functions also depend on `@google-cloud/vertexai` |
| Email | Mailtrap (`src/lib/mailtrap.ts`) |
| Tables / charts | `@tanstack/react-table`, `recharts` |
| Forms | react-hook-form + Zod (schemas live in `src/lib/types.ts`) |
| State | React Context (`Cart`, `Wishlist`, `Currency`, `Language`) |
| Testing | Vitest 4 + jsdom + Testing Library, Playwright (Chromium) |
| PWA | `next-pwa` (disabled in dev) + `public/manifest.json` + workbox sw |
| Hosting | Vercel (`vercel.json`, region `fra1`) is the app host; Firebase Hosting (`firebase-hosting/`) exists only to rewrite `/api/stripe/webhook` → `handleStripeWebhook`. `apphosting.yaml` is a leftover Firebase App Hosting stub. |

## 3. Top-level layout

```
/
├── .claude/launch.json          # Dev server & functions emulator launch configs
├── .github/workflows/ci.yml     # Quality (typecheck/test/build) + E2E on PR
├── apphosting.yaml              # Firebase App Hosting stub (maxInstances only)
├── firebase.json                # Firestore/Storage/Functions/Hosting/emulator config
├── firestore.rules              # Security rules (see §7)
├── firestore.indexes.json       # Composite indexes: products, conversations, notifications, admin_logs
├── storage.rules                # Firebase Storage rules (users/, products/, deliveries/)
├── next.config.js               # PWA, CSP, security headers, remote image patterns
├── next-sitemap.config.js       # Sitemap + robots.txt generated postbuild
├── tailwind.config.ts
├── tsconfig.json                # paths: "@/*" → "./src/*"
├── vitest.config.ts             # jsdom env, setup at src/__tests__/setup.ts
├── playwright.config.ts         # baseURL http://localhost:3001, spins up `npm run dev`
├── vercel.json                  # fra1, 30s maxDuration on src/app/api/**
├── CHANGELOG.md / FEATURES.md / README.md
├── docs/
│   ├── blueprint.md             # Design/brand spec
│   ├── backend.json
│   ├── payments.md              # Stripe/Connect operator runbook
│   ├── payments-status.md       # What's live vs. blocked (see §8)
│   └── vercel-deploy.md
├── e2e/                         # admin, auth, home, search specs
├── functions/                   # Firebase Cloud Functions — one 900-line src/index.ts
├── scripts/                     # set-admin-role.ts, set-super-admin.mjs, seed-brands.mjs, delete-no-photo-products.*
├── public/                      # manifest, icons, logo, sitemap, sw assets
└── src/
    ├── middleware.ts            # Edge middleware — auth gate + CSRF
    ├── app/                     # Next App Router tree
    ├── ai/                      # Genkit config + flows
    ├── components/              # Feature + UI components
    ├── context/                 # Cart / Wishlist / Currency / Language providers
    ├── firebase/                # Client SDK init + hooks + provider + error emitter
    ├── hooks/                   # admin/courier auth, search suggestions, preferences, …
    ├── lib/                     # Types, order lifecycle, permissions, rate-limit, env, i18n JSON
    ├── services/                # ProductService / OrderService / UserService / image upload
    └── __tests__/               # Vitest setup + tests
```

## 4. App Router map (`src/app/`)

**`/` is a splash screen that `router.replace('/home')`** — `/home` is the real homepage (client component, reads `?macroFilter=`). Don't add homepage content to `src/app/page.tsx`.

Public:
- `/` (splash) → `/home` (New Arrivals, Recently Viewed, Personalized Picks, Categories, MacroFilters, HomepageBlocks)
- `/about`, `/help`, `/privacy`, `/terms`
- `/browse` and `/browse/[...slug]` — filtered browsing (category/price/etc. via URL segments + params)
- `/search` — search results, backed by the smart-search AI flow; overlay lives in `components/search/search-overlay.tsx`
- `/products/[id]` (+ `layout.tsx` supplying server-rendered metadata and JSON-LD via `src/lib/product-seo.ts`)
- `/delivery-partner` and `/delivery-partner/apply` — courier recruitment funnel
- `/(onboarding)/welcome` — first-run flow

Auth (`/auth/*`): `login`, `signup`, `forgot-password`, `reset-password`, `verify-email`, plus an `/auth` index.

Authenticated (gated by middleware §6):
- `/profile`, `/profile/addresses`, `/profile/listings`, `/profile/listings/sales/[orderId]`, `/profile/orders`, `/profile/orders/[orderId]`, `/profile/offers`, `/profile/earnings`, `/profile/wallet`, `/profile/payments`, `/profile/settings`, `/profile/stripe-onboarding`
- `/sell` — listing wizard. Entry is a **mode choice** (`ListingModeStep`): manual, or the AI assistant (§7). The wizard itself is 6 numbered steps + success, rendered by `switch (currentStep)` in `src/app/sell/page.tsx`: 1 Photos → 2 Category → 3 Description → 4 Details → 5 Pricing → 6 Review → 7 Success. State lives in `SellFormContext` (localStorage drafts, `marigo_sell_drafts_v7`); server actions in `src/app/sell/actions.ts`. There is no separate Address step — the pickup address is chosen inside `ReviewStep`, which also uploads the images and writes the product as `pending_review`.
- `/products/[id]/edit` — edit an existing listing (mirrors the sell flow)
- `/products/[id]/offers/[offerId]` — offer detail / negotiation
- `/cart`, `/checkout`, `/checkout/success/[orderId]`
- `/messages`, `/messages/[conversationId]` — real-time chat
- `/favorites`, `/notifications`

Courier (`/courier/*`, role-gated): `dashboard`, `jobs`, `delivery/[deliveryId]`, `earnings`, `profile`.

Admin (`/admin/*`, role-gated). Sidebar entries map 1:1 to permissions from `src/lib/admin-permissions.ts`:
`/admin` (dashboard), `products` (+ `[id]`), `orders` (+ `[id]`), `users`, `finance`, `marketing`, `logistics`, `moderation`, `disputes`, `refunds`, `returns`, `support`, `logs`, `settings`.
- **`/admin/danger/reset-orders`** — unlinked destructive operator tool: wipes every order, restocks products, decrements seller `salesCount`, and deletes the related returns/refunds/disputes/transactions. Two confirmation gates + typing `RESET`. Deliberately absent from navigation.

API routes (`src/app/api/`):

| Route | Auth | Notes |
|---|---|---|
| `ai/generate-description`, `ai/recommendations`, `ai/remove-background` | — | CSRF-exempt (stateless) |
| `ai/draft-listing` | Bearer ID token | Multimodal: photos + a hint → a `Partial<SellFormValues>` snapped to the live taxonomy (§7). Spends model quota, so it is not open to anonymous callers |
| `chat` | — | Genkit chatbot; CSRF-exempt |
| `create-payment-intent` | Bearer ID token | Rate-limited; creates the Stripe PI |
| `create-order` | Bearer ID token | Rate-limited; sends buyer + seller mail |
| `stripe/create-connected-account` | Bearer ID token | Same-origin mirror of the `createStripeConnectedAccount` function — exists because org policy blocks `allUsers` invoker on the deployed function (§8) |
| `upload` | Bearer ID token | Rate-limited; service-role Supabase upload to `product-images` |
| `admin/upload`, `admin/product-upload` | Bearer ID token + admin role check | Admin-side image ingest |
| `start-conversation` | Bearer ID token | Rate-limited; writes via Firestore REST |
| `forgot-password` | — | Rate-limited; proxies the `sendPasswordResetLink` function with `RESET_SERVICE_SECRET` |

## 5. Data model (Firestore)

Types in `src/lib/types.ts` (~855 lines — the single source of truth for both TS interfaces and Zod schemas).

| Collection | Purpose | Key statuses |
|---|---|---|
| `users/{uid}` | Profile, role, KYC, `stripeAccountId`, `salesCount`, badge tier, preferences | `active` / `banned` |
| `users/{uid}/{wishlist,cart,addresses,paymentMethods}` | Owner-only subcollections | — |
| `products/{id}` | Listings (images, variants, quantity) | `draft`, `pending_review`, `active`, `sold`, `removed`, `expired`, `reserved` |
| `products/{id}/offers/{offerId}` | Buyer→seller offers | `pending`, `accepted`, `rejected`, `expired` |
| `orders/{id}` | Checkout orders (multi-seller via `sellerIds[]`, `payouts{}` map for idempotent transfers) | `pending_payment`, `processing`, `shipped`, `delivered`, `completed`, `cancelled`, `refunded` |
| `transactions/{id}` | **Append-only finance ledger.** Admin-create only, `update: false`; readable by the tied user or an admin | — |
| `deliveries/{id}` | Courier delivery tasks | `pending_assignment`, `assigned`, `arrived_for_pickup`, `picked_up`, `in_transit`, `arrived_for_delivery`, `delivered`, `cancelled` |
| `courier_profiles/{uid}` | Courier KYC & vehicle info | — |
| `conversations/{id}/messages/{mid}` | Real-time buyer↔seller chat | — |
| `support_chats/{id}/messages/{mid}` | User↔admin support (supports `product_card` messages) | — |
| `notifications/{id}` | Per-user notifications | `read` flag |
| `reports/{id}` | User-filed reports (moderation) | `pending`, `resolved` |
| `reviews/{id}` | Seller/product reviews | — |
| `refunds/{id}`, `disputes/{id}`, `returns/{id}` | Post-purchase workflows (returns have a buyer-driven → seller-driven transition ladder enforced in rules) | — |
| `coupons/{id}` | Discount codes (admin-writable, signed-in read) | — |
| `categories`, `brands`, `conditions`, `materials`, `colors`, `patterns`, `size_charts` | Catalog metadata (public read, admin write) | — |
| `settings/global` | `commissionRate`, `payoutHoldHours`, `refundWindowDays` (full-admin write) | — |
| `settings/{banners,macro_filters,homepage_blocks,badges}` | Merchandising + badge config (admin write) | — |
| `config/exchangeRates` | EUR-base rates for `CurrencyContext` (EUR / ALL / USD) | — |
| `admin_logs/{id}` | Audit trail of admin actions | — |

Defaults in `src/lib/types.ts` — `DEFAULT_PAYOUT_HOLD_HOURS = 72`, `DEFAULT_REFUND_WINDOW_DAYS = 14`, `DEFAULT_COMMISSION_RATE = 0.15`, plus `DEFAULT_BADGE_SETTINGS` and `DEFAULT_RELATED_PRODUCTS_CONFIG`. **`functions/src/index.ts` re-declares the hold/commission defaults — keep both sides in sync.**

Seller badges: `SellerBadgeLevel` = `trusted | expert | activist | official`, thresholds configurable via `settings/badges` (`useBadgeSettings`).

Roles (`UserRoleEnum`): `buyer`, `seller`, `courier`, `admin`, `super_admin`, `moderator`, `analyst`.

## 6. Security architecture

**Edge middleware (`src/middleware.ts`):**
1. Redirects unauthenticated requests on `/profile`, `/sell`, `/cart`, `/checkout`, `/messages`, `/notifications`, `/favorites`, `/admin/*`, `/courier/*` to `/auth/login?redirect=...`. Presence check on `__session` or `marigo_auth` cookie only — full JWT verification happens per API route.
2. CSRF: double-submit cookie (`__csrf` + `x-csrf-token` header) on `POST/PUT/PATCH/DELETE` to `/api/*`, except Bearer-token requests and stateless AI routes (`/api/chat`, `/api/ai/*`).
3. Sets `__csrf` on page responses — not httpOnly (JS must read it), SameSite=strict, 24h.

**Server-side auth (`src/lib/firebase-admin.ts`):** `verifyIdToken` validates against Firebase's JWKS with `jose` — no service-account credentials anywhere, which is what lets the app run on Vercel. Firestore reads/writes from API routes go through the REST helpers (`firestoreGet/Query/Update/Create`) using the caller's ID token, so **security rules still apply on the server path**.

**Role gating:** `src/lib/admin-permissions.ts` defines 18 `AdminPermission` values and `ROLE_PERMISSIONS`:
- `super_admin` — everything
- `admin` — everything except `users.change_role`
- `moderator` — dashboard, products, moderation, orders, support, disputes, refunds, returns
- `analyst` — dashboard, finance.view, analytics.view, logs.view

Client hooks `use-admin-auth` / `use-courier-auth` enforce this in the UI; Firestore rules enforce it on data.

**HTTP headers (`next.config.js`):** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS (2y, preload), `X-XSS-Protection`, `Permissions-Policy`, and a strict CSP allowing Stripe / Firebase / Supabase / GA / GTM / Mailtrap. **In dev the CSP additionally allows the Firebase emulator ports** (5001 / 8080 / 9099, http + ws).

**Image hosts:** `**.supabase.co/storage/v1/object/public/**` is wildcarded on purpose — `next/image` *throws* on an unlisted host and takes down the whole page, so rotating `NEXT_PUBLIC_SUPABASE_URL` used to break every page still rendering an old image. Also allowed: `firebasestorage.googleapis.com`, `placehold.co`, `images.unsplash.com`, `picsum.photos`.

**Firestore rules (`firestore.rules`):** every collection has explicit rules — no wildcard catch-all. Helpers: `isSignedIn`, `isOwner`, `isAdmin` (custom claim `admin: true` **or** Firestore role in admin/super_admin/moderator/analyst), `isFullAdmin`, `isCourier`. Notable narrow grants: any signed-in user may decrement `products.quantity` / flip to `reserved` at checkout; buyers drive `approved → ready_for_pickup → shipping` on returns, sellers drive `shipping → received`.

**Storage rules (`storage.rules`):** `users/{uid}/**` and `products/{uid}/{productId}/*` are owner-write / public-read; `deliveries/{id}/*` is signed-in read+write. All writes require an image content type under 10 MB. Note admin checks here use the custom claim **only** (no Firestore fallback).

**Rate limiting:** `src/lib/rate-limit.ts` — in-memory limiters for `forgot-password`, `upload`, `create-order`, `payment-intent`, `conversation`, applied via `applyRateLimit(req, limiter)`.

## 7. AI surface (Genkit)

Entry: `src/ai/genkit.ts` — `googleAI()` plugin with an explicit default model; without a default, every `generate()` call fails with `INVALID_ARGUMENT`.

**Model ids live in `src/ai/models.ts`, not scattered through the routes.** `TEXT_MODEL` / `IMAGE_MODEL` are env-overridable (`GENAI_TEXT_MODEL`, `GENAI_IMAGE_MODEL`), and `generateText()` wraps `ai.generate()` with automatic failover down `TEXT_FALLBACKS` when Google 404s a retired model. This exists because `gemini-2.0-flash` was hardcoded in two places, got retired, and took down chat + pricing + descriptions + recommendations + smart-search simultaneously with no non-deploy recovery. Prefer `generateText()` over `ai.generate()` in new flows.

Flows in `src/ai/flows/` (each exports a Zod input/output schema pair plus an async wrapper):
- `ai-suggest-price.ts` → `suggestPrice` — seller price suggestion
- `generate-description.ts` → `generateDescription` — listing copy
- `get-recommendations.ts` → `getRecommendations` — product recommendations
- `smart-search.ts` → `smartSearch` — semantic search backing `/search`
- `remove-background.ts` → `removeBackground` — product-image cleanup
- `ai-chat.ts` → types + `chatWithAI` client helper; the logic lives in `src/app/api/chat/route.ts`

`src/components/ai/flows/` holds thin client wrappers for the price/description flows.

### AI-assisted listing (`/api/ai/draft-listing` + `components/sell/AiListingAssistant`)

The seller picks **List with AI Assistant** at the top of `/sell`, adds up to 9 photos and a one-line hint ("Zara Black Satin Dress"), and gets a pre-filled draft to review.

- **Two image sizes, on purpose.** The photos kept for publishing are compressed like the manual Photos step (0.8 MB / 1200px); a much smaller copy (0.12 MB / 640px) is what goes to the model. Nine full-size photos would exceed the request body limit and the 30s Vercel ceiling, and the extra detail buys nothing.
- **Output is snapped to the live catalog, never trusted raw.** `src/lib/listing-taxonomy.ts` loads brands/categories/sub-categories/conditions/colours/materials/patterns (1h cache) and `matchOption()` maps the model's wording onto real stored values — "Burnt Orange" → `burnt-orange`, "Very Good" → `very-good-condition`. **Anything unmatched is left blank** rather than guessed, so the wizard never shows a value its selects cannot bind.
- Nothing is written to Firestore by the route. It returns a `Partial<SellFormValues>`; the client calls `startNewDraft({ formData, step: 6 })` so the seller lands directly on **Review** and publishes through the normal path.
- Sizes are only filled when a label is legible in a photo — the prompt forbids guessing one.
- Note: this path allows 9 photos while the manual `PhotosStep` caps at 8.

Firestore REST plumbing shared by the chatbot and the taxonomy loader lives in `src/lib/firestore-rest.ts`.

### The chatbot (`/api/chat` + `components/ai/ChatbotWidget`)

A turn is **retrieve → generate → sanitize**:

1. `src/lib/chat-retrieval.ts` matches the message against the live `brands` / `categories` / active `products` catalog with **no LLM involved** — accent-folded token ranking mirroring `use-search-suggestions.ts`, module-cached for 5 min over Firestore REST. So "a keni ndonje gje nga Zara?" resolves to real listings deterministically, in either language, *even when the model is down*.
   - **Listings are catalogued in English; visitors ask in Albanian.** `src/lib/chat-lexicon.ts` bridges the two — "taka" → heels, "portokalli" → orange. It also maps colour families to the shade names listings actually store (`orange` → `coral`), which English queries need too: the orange Zara heels are recorded as `color: "coral"`, so before this only the title matched.
   - Matching runs over `title`, brand, category, sub-category, colour, material, condition, size, pattern **and `description`** — so a term that only appears in the seller's prose still finds the listing.
   - Matching prefers listings answering *every* term, then falls back to the best partial ones flagged `isApproximate`, so the assistant offers similar items instead of "we have nothing". Product-type terms (`GARMENT_TERMS`) are decisive in that fallback — "fustan te zi" with no black dress in stock must offer other dresses, never a black belt.
   - `parsePriceFilter()` handles "nën 50 euro" / "under 20" / "mbi 100" / "diçka e lirë". It parses the **normalised** message: JS `\b` is ASCII-only, so `/\blire\b/` never matches "lirë" in raw text. Listings priced `0` are excluded from price queries — offering a €0 item as "cheapest" is worse than omitting it.
   - **Extend the lexicon whenever the catalog gains vocabulary**, or Albanian searches for it will silently return nothing.
2. One grounded generation. The prompt carries `src/lib/chat-knowledge.ts` (platform facts + persona), the retrieved listings, and whether the visitor is signed in — so it answers "how do I sell?" with a sign-up link first when signed out. It replies in the language the visitor wrote in.
3. `sanitizeChatLinks()` allow-lists every link before it reaches the browser. The model chooses links, so they are untrusted: absolute URLs, `//host`, `javascript:` and backslash bypasses are dropped. Covered by `src/__tests__/lib/chat-knowledge.test.ts`, including a guard that the knowledge prose only cites allow-listed routes.

Degradation is deliberate: if generation fails but retrieval succeeded, the route still returns the products with a bilingual lead-in rather than an error.

The widget is lazy (`ssr: false`) in `src/app/layout.tsx`, opens on a global `open-chatbot` event (fired from `/help`), and its FAB is desktop-only (`hidden md:inline-flex`). Transcripts persist to `support_chats` **only for signed-in users** and strictly fire-and-forget — answering must never depend on the write. It used to, which meant signed-out visitors got no reply at all.

## 8. Payments & escrow

**Model: manual-capture escrow.** The buyer's card is *authorized* at checkout (`capture_method: 'manual'`), funds are captured only after delivery + a hold window, then split to sellers over Stripe Connect.

Client: Stripe Elements in `components/checkout/payment-step.tsx`, wrapped by `components/providers/stripe-provider.tsx`.

Cloud Functions (`functions/src/index.ts`, region `europe-west1`, secrets from Secret Manager — `STRIPE_SECRET_KEY`, `STRIPE_WH_SECRET`, `APP_URL`):

| Function | Kind | Role |
|---|---|---|
| `createPaymentIntent` | callable | Creates the manual-capture PI |
| `createOrder` | callable | Order creation |
| `updateOrderStatus` | callable | Status transitions, marks products sold / releases on refund, fans out notifications |
| `handleStripeWebhook` | HTTP | Verifies signature; handles `payment_intent.amount_capturable_updated`, `.succeeded`, `.payment_failed`, `.canceled`, `charge.refunded` |
| `capturePayment` | callable | Captures held funds (order must be processing/shipped/delivered) → `completed`, then splits to sellers |
| `releaseEscrow` | scheduled, hourly | Auto-captures `delivered` card orders older than `payoutHoldHours`, then splits |
| `processRefund` | callable | Admin refund |
| `createStripeConnectedAccount` | callable | Connect Express onboarding |
| `getSellerBalance`, `requestPayout` | callable | Seller wallet (`/profile/wallet`, `/profile/earnings`) |
| `sendPasswordResetLink` | HTTP | Backs `/api/forgot-password` |

`distributeOrderToSellers` computes each seller's net (`subtotal × (1 − commissionRate)`), transfers into their connected account, and writes ledger rows. **Idempotent** via a `payouts[sellerId].transferId` map on the order, so retried captures no-op. Sellers with no `stripeAccountId` are skipped and flagged for manual settlement.

**Known blocker (see `docs/payments-status.md`):** the GCP org policy `constraints/iam.allowedPolicyMemberDomains` prevents granting `allUsers` invoker on Cloud Functions, so the Stripe webhook and the Firebase Hosting rewrite both return 403. The Connect-onboarding path was worked around with the same-origin `/api/stripe/create-connected-account` route; the webhook has no workaround yet. `docs/payments.md` is the operator runbook (dashboard setup, `functions/.env`, `settings/global` values).

## 9. Frontend patterns

- Path alias `@/*` → `src/*`.
- Forms: React Hook Form + `zodResolver`; schemas colocated with types in `src/lib/types.ts`.
- Data fetching: `src/firebase/firestore/use-collection.tsx` / `use-doc.tsx` (+ `useMemoFirebase` for stable refs); auth actions in `src/firebase/auth/actions.ts`; `FirebaseClientProvider` wraps the tree.
- Provider order in `src/app/layout.tsx`: Firebase → Language → Currency → Cart → Wishlist.
- Layout: root uses `min-h-[100dvh]` (not `vh` — iOS reports the expanded-toolbar height) with `<main className="flex flex-1 flex-col">` so full-height pages claim leftover space via `flex-1` instead of subtracting a hardcoded chrome height.
- Order status is modelled audience-aware in `src/lib/order-status.ts`: `STATUS_RANK`, `statusLabel(status, 'buyer'|'seller'|'admin')`, `TIMELINE_STEPS` / `TIMELINE_STEPS_SELLER`, `nextSellerTransition` / `nextAdminTransition`.
- Order side-effects live in `src/lib/order-lifecycle.ts` (`recordRefund`, `recordReturn`, `recordRefundForReturn`, `recordRefundForDispute`) and `src/lib/order-inventory.ts` (`releaseOrderItems`, `markOrderItemsSoldIfDepleted`).
- Notifications: `src/lib/notifications.ts` (`notifyUser`, `notifyOrderStatus`, `humanReadableStatus`).
- Admin tables are a repeated shadcn + `@tanstack/react-table` pattern: `data-table.tsx` + `columns.tsx` + `data-table-toolbar.tsx` + `data-table-pagination.tsx` (+ `row-actions`) per domain (`products`, `orders`, `users`, `finance`, `logs`, `logistics/courier-table`). Copy an existing folder rather than inventing a new shape. CSV export via `src/lib/csv-export.ts`.
- Admin charts in `components/admin/charts/` use `recharts` + `components/ui/chart.tsx`.
- i18n: `src/lib/translations/{en,sq}.json` via `LanguageContext` (`it.json` is dormant); preference persisted to a cookie and to the user doc.
- Currency: `CurrencyContext` + `config/exchangeRates` (EUR base; ALL / USD), persisted to `marigo_currency` cookie + user doc. Prices are stored in EUR — always format via `formatPrice`.
- Mobile-first: bottom `MobileNav` (Home/Search/Cart/Favorites/Profile), hidden ≥ md; header popovers for cart/messages/notifications.
- Error reporting: `src/lib/error-reporter.ts` (`reportError`, `reportWarning`) + `FirebaseErrorListener` mounted globally, fed by `src/firebase/error-emitter.ts`.

## 10. Commands (from `package.json`)

```
npm run dev         # Next dev on PORT (default 3001)
npm run build       # Production build (next-sitemap runs postbuild)
npm run start       # Run built app
npm run lint        # next lint
npm run typecheck   # tsc --noEmit   (CI continue-on-error — pre-existing errors)
npm run test        # Vitest (jsdom) — src/**/*.{test,spec}.{ts,tsx}
npm run test:watch  # Vitest watch
npm run test:e2e    # Playwright against localhost:3001 (starts the dev server itself)
```

Functions (inside `functions/`): `npm run build` (tsc), `npm run serve` (build + functions emulator), `npm run deploy`, `npm run logs`.

`.claude/launch.json` defines two preview configs: **Next.js Dev Server** (port 3001) and **Firebase Functions Emulator** (port 5001). Emulator ports: functions 5001, firestore 8080, auth 9099, UI disabled.

Utility scripts (`scripts/`): `set-admin-role.ts`, `set-super-admin.mjs`, `seed-brands.mjs`, `delete-no-photo-products.{js,mjs}`.

Current tests: unit/component — `admin-permissions`, `cookies`, `csv-export`, `error-reporter`, `rate-limit`, `types`, `product-card`, `confirm-action-dialog`. E2E — `admin`, `auth`, `home`, `search`.

## 11. CI (`.github/workflows/ci.yml`)

- Triggers: push to `main` / `marigoappv1.0`, PRs to `main`.
- `quality` job: `npm ci` → typecheck (`continue-on-error: true`) → `npm run test` → `next build` with dummy `NEXT_PUBLIC_FIREBASE_*` env.
- `e2e` job (PRs only, `needs: quality`): Playwright + Chromium; uploads `playwright-report/` (7-day retention).
- Because the build runs with placeholder env, **nothing may construct a Supabase/Stripe/Firebase client at module scope** — use lazy getters (`getSupabaseClient()`, `getStripe()`). This has broken CI before.

## 12. Environment variables (`.env.example`)

```
NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID / APP_ID / FUNCTIONS_REGION=europe-west1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  + STRIPE_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL / ANON_KEY + SUPABASE_SERVICE_ROLE_KEY
GOOGLE_GENAI_API_KEY
MAILTRAP_TOKEN
RESET_SERVICE_SECRET
SITE_URL                      # optional; overrides the marigoapp.com default
```

`src/lib/env.ts` validates these with Zod (`clientEnv` for the browser bundle, `getServerEnv()` server-side). Functions read `STRIPE_SECRET_KEY` / `STRIPE_WH_SECRET` / `APP_URL` from Secret Manager, falling back to `functions/.env` (untracked; `STRIPE_SK` is also accepted).

## 13. Known gotchas

- **TS build errors are silenced** (`next.config.js` `typescript.ignoreBuildErrors: true`, `eslint.ignoreDuringBuilds: true`); CI typecheck is `continue-on-error`. Fix before flipping either flag.
- `FirestoreTimestamp` is a union (`Timestamp | FieldValue | {seconds,nanoseconds}`) — use the `toDate()` helper in `src/lib/types.ts`, never `.toDate()` directly.
- `src/app/page.tsx` is a splash redirect. Homepage work belongs in `src/app/home/page.tsx`.
- Dev server port is **3001** (`package.json` + `playwright.config.ts` + `.claude/launch.json`).
- PWA is disabled in dev (`next-pwa` `disable: NODE_ENV === 'development'`).
- Supabase now uses one bucket, `product-images`, from `src/lib/supabase.ts`. The `next.config.js` Supabase host is wildcarded — don't narrow it back to a project id.
- Middleware does **not** verify JWTs at the Edge (JWKS network cost); every API route must call `verifyIdToken` itself.
- No wildcard Firestore rule — a new collection without explicit rules is denied for every read and write.
- The commission/hold defaults exist twice (`src/lib/types.ts` and `functions/src/index.ts`). Changing one without the other silently diverges the UI from the payout math.
- Cloud Functions requiring public invocation (`handleStripeWebhook`) are currently blocked by org policy — see §8 before assuming a webhook fires.
- `src/lib/mock-data.ts` (~326 lines of sample products, brands, sizes) is still imported in places; check whether a value is real Firestore data or mock before relying on it.
- **Gemini models get retired without notice** and then 404. Never hardcode a model id in a route — use `TEXT_MODEL`/`generateText()` from `src/ai/models.ts`, or set `GENAI_TEXT_MODEL` to recover without a deploy.
- **The Google AI free tier caps generation at ~20 requests before 429ing** (`generate_content_free_tier_requests`). That is well below real chat traffic, so production needs billing enabled on the GCP project. The chat route degrades to retrieval-only results rather than erroring, which makes the ceiling easy to miss — check the server log for `RESOURCE_EXHAUSTED` if replies suddenly read like canned copy.
- Radix `Sheet` panels are `inset-y-0 h-full`, i.e. sized to the **layout** viewport, which iOS does not shrink for the on-screen keyboard — Safari scrolls the panel instead and the header disappears. `useVisualViewport()` (`src/hooks/use-visual-viewport.ts`) pins a panel to the visual viewport; the chatbot uses it. Any other full-height sheet with a text input needs the same treatment.
