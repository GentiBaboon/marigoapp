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

Locale: `<html lang="en">` — it must match the *server-rendered* content, and `LanguageContext` **defaults to `en`** (it said `sq` while serving English, which misfiles the site for both languages) and the picker offers `en` / `sq` only — Italian was pulled from the UI, `it.json` is retained in case it returns.

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
| Email | SendGrid v3 REST (`src/lib/email/`) — see `docs/email.md`. `src/lib/mailtrap.ts` is the superseded predecessor |
| Tables / charts | `@tanstack/react-table`, `recharts` |
| Forms | react-hook-form + Zod (schemas live in `src/lib/types.ts`) |
| State | React Context (`Cart`, `Wishlist`, `Currency`, `Language`) |
| Testing | Vitest 4 + jsdom + Testing Library, Playwright (Chromium) |
| PWA | `next-pwa` (disabled in dev) + `public/manifest.json` + workbox sw |
| Hosting | Vercel (`vercel.json`, region `fra1`) is the app host; Firebase Hosting (`firebase-hosting/`) exists only to rewrite `/api/stripe/webhook` → `handleStripeWebhook`. `apphosting.yaml` is a leftover Firebase App Hosting stub. |
| iOS / Android | Capacitor 6 (`capacitor.config.ts`, `ios/`, `android/`) wrapping a static export of this same `src/` — see §14 |

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
├── public/                      # manifest, icons, logo, favicon.ico, marigo-ai-avatar.png, sitemap, sw
└── src/
    ├── middleware.ts            # Edge middleware — auth gate + CSRF
    ├── app/                     # Next App Router tree (+ icon.png / apple-icon.png conventions)
    ├── ai/                      # Genkit config, models.ts (failover), flows
    ├── components/              # Feature + UI components
    ├── context/                 # Cart / Wishlist / Currency / Language providers
    ├── firebase/                # Client SDK init + hooks + provider + error emitter
    ├── hooks/                   # admin/courier auth, search suggestions, preferences, visual viewport
    ├── lib/                     # Types, order lifecycle, permissions, rate-limit, env, i18n JSON,
    │                            #   chat-{knowledge,lexicon,retrieval}, listing-taxonomy, firestore-rest
    ├── services/                # ProductService / OrderService / UserService / image upload
    └── __tests__/               # Vitest setup + tests
```

## 4. App Router map (`src/app/`)

**`/` is a splash screen that `router.replace('/home')`** — `/home` is the real homepage (client component, reads `?macroFilter=`). Don't add homepage content to `src/app/page.tsx`.

Public:
- `/` (splash) → `/home`. Section order is deliberate and lives in `src/app/home/page.tsx`: MacroFilters → HomepageBlocks → Personalized Picks → **Shop by Category** → **New In** → **50% OFF Preowned** → **Last Viewed**. Last Viewed is pinned last — it is a way back to something already seen, so it sits below everything still being discovered. Every section returns `null` when it has nothing to show, so the page has no empty headings.
  - Component names lag the headings: `NewArrivalsSection` renders "New In" and `RecentlyViewedSection` renders "Last Viewed".
  - `DiscountedSection` ("50% OFF Preowned") filters on a **computed** discount, which Firestore cannot query — it pulls a 100-row pool and works out `(originalPrice − price) / originalPrice` per item, deepest markdown first. Threshold is **≥49%**, not 50, so an item at 35 ← 69 (49.3%) still qualifies. Sold listings are excluded here, unlike other rails: a half-price item you cannot buy is worse than one fewer card.
  - Passing `?macroFilter=<id>` replaces the whole stack with `MacroFilteredProducts`.
- `/about`, `/help`, `/privacy`, `/terms`
- `/browse` and `/browse/[...slug]` — filtered browsing (category/price/etc. via URL segments + params)
- `/search` — search results, backed by the smart-search AI flow; overlay lives in `components/search/search-overlay.tsx`. The results grid itself is `search/client-page.tsx`, exported as `SearchResults` so the category routes can reuse it.
- **`/{gender}` and `/{gender}/{category}`** (`/women`, `/women/shirts`) — the
  indexable form of `/search?gender=…&category=…`. Query strings make one URL
  with parameters; these are real pages with their own title and canonical.
  - Filters are injected by `FilterOverrideContext` in `search/client-page.tsx`
    and merged *underneath* the query string, so `/women/shirts?color=black`
    still narrows and the filter sheet keeps writing query params.
  - These sit at the **root**, so an unmatched top-level path lands here.
    `isGenderSegment()` gates it and anything else `notFound()`s — without that
    the catch-all would answer 200 for every typo. `src/lib/category-url.ts`
    owns the vocabulary; `buildCategoryPath()` falls back to the `/search?` form
    for a gender that is not routed, so a link never points at a 404.
  - The native rules are anchored to the four literal genders for the same
    reason: `/^\/([^/]+)\/([^/]+)$/` would rewrite `/admin/orders` into a
    category page.
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

### Marigo, the AI shopping assistant (`/api/chat` + `components/ai/ChatbotWidget`)

Presented as **"Marigo — AI Shopping Assistant"** with a character avatar
(`public/marigo-ai-avatar.png`), not a support bot. She greets signed-in
visitors by their Marigo profile name ("Hi Gigis Closet!") in Albanian or
English per the site locale, and that name is passed to the model so she can
use it mid-conversation.

The avatar is used **uncropped** — the artwork already fills its square, so the
round mask takes only the bottom corners of her suit. Cropping it first (even
centred) sliced the top off her hair; padding it to clear the circle entirely
left her floating in white. Don't "fix" the framing.

A turn is **retrieve → generate → sanitize**:

1. `src/lib/chat-retrieval.ts` matches the message against the live `brands` / `categories` / active `products` catalog with **no LLM involved** — accent-folded token ranking mirroring `use-search-suggestions.ts`, module-cached for 5 min over Firestore REST. So "a keni ndonje gje nga Zara?" resolves to real listings deterministically, in either language, *even when the model is down*.
   - **Listings are catalogued in English; visitors ask in Albanian.** `src/lib/chat-lexicon.ts` bridges the two — "taka" → heels, "portokalli" → orange. It also maps colour families to the shade names listings actually store (`orange` → `coral`), which English queries need too: the orange Zara heels are recorded as `color: "coral"`, so before this only the title matched.
   - Matching runs over `title`, brand, category, sub-category, colour, material, condition, size, pattern **and `description`** — so a term that only appears in the seller's prose still finds the listing.
   - Matching prefers listings answering *every* term, then falls back to the best partial ones flagged `isApproximate`, so the assistant offers similar items instead of "we have nothing". Product-type terms (`GARMENT_TERMS`) are decisive in that fallback — "fustan te zi" with no black dress in stock must offer other dresses, never a black belt.
   - `parsePriceFilter()` handles "nën 50 euro" / "under 20" / "mbi 100" / "diçka e lirë". It parses the **normalised** message: JS `\b` is ASCII-only, so `/\blire\b/` never matches "lirë" in raw text. Listings priced `0` are excluded from price queries — offering a €0 item as "cheapest" is worse than omitting it.
   - **Tokens shorter than 4 characters must match a whole word.** Substring matching on them is nearly always a false positive: "Si je?" ("how are you?") was returning Calvin Klein **Je**ans. Small-talk vocabulary is also in `STOP_WORDS`, so greetings never reach retrieval at all.
   - **Extend the lexicon whenever the catalog gains vocabulary**, or Albanian searches for it will silently return nothing.
2. One grounded generation. The prompt carries `src/lib/chat-knowledge.ts` — platform facts plus `CHAT_PERSONA` — the retrieved listings, the visitor's name, and whether they are signed in, so it answers "how do I sell?" with a sign-up link first when signed out.
   - **Tone is taught with worked examples, not adjectives.** `CHAT_PERSONA` carries four sample exchanges (both languages); models copy demonstrated voice far more reliably than described voice.
   - A **"Hard rules" block explicitly outranks the personality**. An enthusiastic assistant is precisely the kind that invents stock to be helpful, so "never describe a listing outside the retrieved results" has to beat "be warm and confident".
   - The **answer language is decided in code**, by `detectChatLanguage()`, and handed to the model as `REPLY LANGUAGE`. Asking the model to mirror the visitor was unreliable — English questions came back in Albanian, because the surrounding prompt is full of Albanian. The site locale only breaks ties on messages with no language signal ("Gucci?").
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
- **`useCollection` opens a live `onSnapshot` listener.** Every component that mounts one pays a full read of its result set, and two components reading the same collection pay twice. Use it for data that genuinely changes under the user — products, orders, messages, notifications.
- **Catalog reference data goes through `useCatalog()`** (`src/hooks/use-catalog.ts`, backed by `src/lib/catalog-cache.ts`), never `useCollection`. `brands` (141), `categories` (127), `colors` (97), `materials` (107), `patterns` (92), `conditions` (4) and `size_charts` (20) total ~588 documents — twenty-plus times the product collection — and change only when an admin edits them. They are now fetched once per session with `getDocs`, shared by every consumer and persisted to `sessionStorage`. `/search` alone was reading ~836 documents per visit, including `brands` and `categories` **twice** in the same render.
  - Trade-off: catalog edits are not live in an open shopper tab; they land on the next session or after the 30-minute TTL. `/admin/settings` calls `invalidateCatalog()` on unmount so an admin sees their own edits, and admin screens keep live listeners.
- Provider order in `src/app/layout.tsx`: Firebase → Language → Currency → Cart → Wishlist.
- Layout: root uses `min-h-[100dvh]` (not `vh` — iOS reports the expanded-toolbar height) with `<main className="flex flex-1 flex-col">` so full-height pages claim leftover space via `flex-1` instead of subtracting a hardcoded chrome height.
- Order status is modelled audience-aware in `src/lib/order-status.ts`: `STATUS_RANK`, `statusLabel(status, 'buyer'|'seller'|'admin')`, `TIMELINE_STEPS` / `TIMELINE_STEPS_SELLER`, `nextSellerTransition` / `nextAdminTransition`.
- Order side-effects live in `src/lib/order-lifecycle.ts` (`recordRefund`, `recordReturn`, `recordRefundForReturn`, `recordRefundForDispute`) and `src/lib/order-inventory.ts` (`releaseOrderItems`, `markOrderItemsSoldIfDepleted`).
- Notifications: `src/lib/notifications.ts` (`notifyUser`, `notifyOrderStatus`, `humanReadableStatus`).
- **Sizes come from `src/lib/size-options.ts`, never from a text input.** It
  resolves options as **admin `size_charts` → `SIZE_PRESETS` → `UNIVERSAL_SIZES`**,
  and `resolveSizeOptions()` is guaranteed non-empty for every category × system
  (a test asserts it), which is what allows the sell wizard to have no free-text
  fallback. One value per size: "Small" is not an option beside "S", it is the
  *label* on `S` (`S — Small`), because the size facet on `/search` matches on a
  single key. `normalizeSize()` folds legacy spellings ("Small", "EU 38", "38,5",
  "12 months") onto that key, and `sizesMatch()` is what the facet compares with —
  plain `===` left pre-migration listings unreachable from their own filter pill.
  Entry points: `DetailsStep`, `PricingStep` (variants), `size-config-tab`
  (admin), `/api/ai/draft-listing`, and the `/search` facet.
- Admin tables are a repeated shadcn + `@tanstack/react-table` pattern: `data-table.tsx` + `columns.tsx` + `data-table-toolbar.tsx` + `data-table-pagination.tsx` (+ `row-actions`) per domain (`products`, `orders`, `users`, `finance`, `logs`, `logistics/courier-table`). Copy an existing folder rather than inventing a new shape. CSV export via `src/lib/csv-export.ts`.
- Admin charts in `components/admin/charts/` use `recharts` + `components/ui/chart.tsx`.
- i18n: `src/lib/translations/{en,sq}.json` via `LanguageContext` (`it.json` is dormant); preference persisted to a cookie and to the user doc.
- Currency: `CurrencyContext` + `config/exchangeRates` (EUR base; ALL / USD), persisted to `marigo_currency` cookie + user doc. Prices are stored in EUR — always format via `formatPrice`. **`DEFAULT_CURRENCY` is `ALL`** (the primary market is Albania); a saved cookie or user preference still wins. This is display only — storage, payouts, Stripe amounts and the admin/finance dashboards stay in EUR.
- **SEO: every indexable route declares its own canonical**, via `pageMetadata()`
  in `src/lib/seo.ts`. The root layout's `alternates: { canonical: '/' }` is
  inherited by any page that does not override it — that is how /about, /help,
  /browse, /search, /terms and /privacy all came to declare themselves copies of
  the homepage, which is what Search Console reported as "Duplicate without
  user-selected canonical" and "Alternate page with proper canonical tag".
  Client pages cannot export `metadata`, so each has a sibling `layout.tsx` that
  does (the `products/[id]/layout.tsx` pattern). **Adding a public route means
  adding its layout+canonical**, or it silently claims to be `/`.
  - `/home` canonicals to `/` — they are the same page, since `/` is a splash
    that redirects there. Only `/` is in the sitemap.
  - The flat `/view` native siblings and `/welcome` carry `noindexMetadata()`
    and are deliberately **left crawlable**: a URL blocked in robots.txt can
    still be indexed from an inbound link, and `noindex` only works on a page
    Google is allowed to fetch.
  - `next-sitemap.config.js` derives robots.txt and the sitemap from one
    `PRIVATE_PATHS` list so the two cannot contradict each other. They did:
    `/delivery-partner` was disallowed in robots.txt while sitting in the
    sitemap → "Blocked by robots.txt".
  - **`/sitemap.xml` is the single submitted entry point.** It is an index over
    `sitemap-0.xml` (static pages, from next-sitemap) and `sitemap-products.xml`
    (every active listing, with `<image:image>` extensions). The second file
    cannot come from next-sitemap — listings resolve out of Firestore — so
    `scripts/generate-sitemap.mjs` writes it and appends it to the index. It runs
    in `postbuild`, after next-sitemap, and imports the listing query from
    `src/lib/product-seo.ts` through `jiti` so the two cannot disagree. A
    Firestore failure logs and exits 0: a build must not break over a sitemap.
    New listings therefore enter the sitemap **on the next deploy**.
  - `src/app/server-sitemap.xml/route.ts` still exists as the always-fresh
    alternative but is **not submitted** — the static file is. If it is ever
    submitted, it must **not** declare `export const dynamic`, which would break
    `output: 'export'` for Capacitor.
  - **Listing URLs are `/products/{slug}`** (`src/lib/product-slug.ts`) — no id.
    That makes resolution a **query on `seoSlug`**, not a document read, with
    three consequences: slugs must be unique (`uniqueSlug()`), every listing
    needs a *stored* slug (`scripts/backfill-slugs.mjs`), and the two older
    shapes must still resolve because they are indexed — the bare
    `/products/{id}` and the interim `/products/{slug}--{id}`.
    `resolveSeoProduct()` (server) and the slug effect in
    `products/[id]/client-page.tsx` (client) both try slug → `slug--id` → id.
  - **A listing with no stored slug keeps its id URL.** `buildProductPath`
    deliberately does *not* fall back to a derived slug: a derived slug is not
    in Firestore, so linking to it would 404. Run the backfill after importing
    listings, or they stay on ugly URLs.
    - **Backfill has two front doors**: `scripts/backfill-slugs.mjs` (needs
      service-account credentials) and the **SEO tab in `/admin/settings`**,
      which does the same work from the browser using the admin's own session —
      Firestore rules let an admin update products, so no credentials are
      needed. Both scan first and never overwrite an existing slug.
    - `seoSlug` is stamped once at publish (`ReviewStep`, de-duplicated against
      existing slugs) and **stored**, not derived on read: regenerating from the
      title would silently change a live URL whenever a typo was fixed,
      discarding its ranking. Saving a listing in admin with the slug field
      blank auto-completes it, so an admin never has to think about it.
    - Admins override the slug, meta title and meta description on the SEO card
      in `/admin/products/[id]`. Blank means "use the derived default", and the
      card's preview mirrors the exact fallback chain in
      `products/[id]/layout.tsx` — keep the two in step or the preview lies.
    - Changing `buildProductPath` changes every live URL. Anything emitting a
      product link (ProductCard, search overlay, both sitemaps, the canonical
      and the JSON-LD `offers.url`) must go through it.
  - `public/llms.txt` and `public/llms-full.txt` are the answer-engine (GEO)
    entry points; robots.txt names GPTBot / OAI-SearchBot / ClaudeBot /
    PerplexityBot / Google-Extended et al. explicitly.
- Favicons follow the **App Router icon convention**: `src/app/icon.png` and `src/app/apple-icon.png`, with `public/favicon.ico` for clients that probe that path directly. Do not add a `src/app/favicon.ico` — it is served at `/favicon.ico` and beats any `<link rel="icon">` in `layout.tsx`, which is what kept the old orange mark on screen. Both icon routes are excluded in `next-sitemap.config.js`, or they get listed as pages.
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

npm run build:native  # Static export for the app shells → .next-native
npm run sync:native   # build:native + npx cap sync (copies into ios/ and android/)
npm run ios           # sync + open Xcode
npm run android       # sync + open Android Studio
node scripts/serve-native.mjs --port 3002 --simulate-native   # the app bundle in a browser
```

`NEXT_DIST_DIR=.next-check npm run build` verifies a production build **without**
overwriting `.next`, so it is safe to run while `npm run dev` is up.

Functions (inside `functions/`): `npm run build` (tsc), `npm run serve` (build + functions emulator), `npm run deploy`, `npm run logs`.

`.claude/launch.json` defines two preview configs: **Next.js Dev Server** (port 3001) and **Firebase Functions Emulator** (port 5001). Emulator ports: functions 5001, firestore 8080, auth 9099, UI disabled.

Utility scripts (`scripts/`): `set-admin-role.ts`, `set-super-admin.mjs`, `seed-brands.mjs`, `delete-no-photo-products.{js,mjs}`, `normalize-sizes.mjs`, `generate-sitemap.mjs`, `backfill-slugs.mjs`, `preview-emails.mjs`.

`normalize-sizes.mjs` folds `products.size`, `products.variants[].size` and
`size_charts.sizes[]` onto the canonical vocabulary. **Dry run by default** —
`--apply` writes, `--only=products|charts|all` scopes, `--backup=out.json`
records the diff. It loads the rules from `src/lib/size-options.ts` through
`jiti` rather than restating them, so the script cannot drift from the app.

Current tests (283 passing): unit/component — `admin-permissions`, `catalog-cache`, `chat-knowledge`, `chat-lexicon`, `cookies`, `csv-export`, `error-reporter`, `listing-taxonomy`, `category-url`, `email`, `platform-routes`, `product-slug`, `rate-limit`, `size-options`, `types`, `product-card`, `confirm-action-dialog`. E2E — `admin`, `auth`, `home`, `search`.

The E2E `home` spec asserts on the literal string **"Shop by Category"** (and on `img[alt="Marigo"]` in the header/footer). Renaming that heading breaks the suite — the other homepage headings are not asserted on.

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
SENDGRID_API_KEY / SENDGRID_FROM_EMAIL / SENDGRID_FROM_NAME
MAILTRAP_TOKEN                 # legacy, superseded
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
- **Product documents carry `brandId` / `categoryId`, never `brand` / `category`.** `PersonalizedPicks` filtered on the short names for a long time, so it matched nothing and rendered empty — while still spending a Gemini generation on every signed-in homepage load. Check the field name against `FirestoreProduct` before writing a `where()`.
- Any AI call on a high-traffic page needs a cache. `PersonalizedPicks` keys its recommendation on the taste profile in `sessionStorage`; without that, a few homepage visits by one shopper exhaust the project's daily generation quota for chat and listing too.
- **Gemini models get retired without notice** and then 404. Never hardcode a model id in a route — use `TEXT_MODEL`/`generateText()` from `src/ai/models.ts`, or set `GENAI_TEXT_MODEL` to recover without a deploy.
- **The Google AI free tier caps generation at ~20 requests before 429ing** (`generate_content_free_tier_requests`). That is well below real chat traffic, so production needs billing enabled on the GCP project. The chat route degrades to retrieval-only results rather than erroring, which makes the ceiling easy to miss — check the server log for `RESOURCE_EXHAUSTED` if replies suddenly read like canned copy.
- Radix `Sheet` panels are `inset-y-0 h-full`, i.e. sized to the **layout** viewport, which iOS does not shrink for the on-screen keyboard — Safari scrolls the panel instead and the header disappears. `useVisualViewport()` (`src/hooks/use-visual-viewport.ts`) pins a panel to the visual viewport; the chatbot uses it. Any other full-height sheet with a text input needs the same treatment.
- Implicit form submission on Enter does **not** survive inside a Radix dialog — it handles keydown at the root. Chat-style inputs there need an explicit `onKeyDown` (guarding `shiftKey` and `isComposing`), or the send button becomes the only way to submit.
- Text inputs inside a sheet should be **≥16px**: below that, iOS Safari zooms the page on focus and shoves the panel sideways.
- **Never run `npm run build` while `npm run dev` is running.** The production build overwrites `.next`, and the dev server then 404s every `_next/static/*` chunk — the page renders as unstyled HTML with no error in the terminal. Fix: stop dev, `rm -rf .next`, restart.
- `AuthenticityBadge` returns `null` for products without a completed check. Don't wrap it in a padded container — the wrapper still renders and leaves phantom space. Prefer a flex `gap` so an absent child contributes nothing.
- `next/image` will not serve larger than the `width`/`height` props, whatever the source file holds. A 320px source declared as `width={128}` renders soft on a 64px retina button.

## 14. Native apps (iOS & Android)

One `src/` builds all three platforms. Capacitor 6 wraps a **static export** of the
same React tree; the app is not a remote-URL wrapper, because App Store guideline
4.2 rejects those.

```
npm run dev          → web, SSR on Vercel      (.next)
npm run build:native → static export           (.next-native) → ios/ + android/
```

`NEXT_PUBLIC_BUILD_TARGET=native` is the switch (`next.config.js`). The native
target sets `output: 'export'`, `images.unoptimized`, `trailingSlash`, drops
`headers()` and disables `next-pwa`. It writes to **`.next-native`**, never
`.next`, so a native build can never take down a running dev server.

**What the app carries vs. fetches.** The UI ships inside the binary. Firestore,
Auth, Storage and Stripe are reached directly by the client SDKs exactly as on
web. `/api/*` only exists on Vercel, so `installNativeFetch()`
(`src/lib/platform/api.ts`) rewrites relative API calls to `API_BASE_URL`
(`NEXT_PUBLIC_API_BASE_URL`, defaulting to `SITE_URL`). `src/middleware.ts`
answers those cross-origin calls with CORS for `NATIVE_ORIGINS` only, and exempts
them from CSRF — they carry a Bearer token and no cookies, so there is no ambient
authority to forge.

### Dynamic routes are the load-bearing part

A static export cannot emit a page per product id, so **every dynamic route has a
flat sibling** that takes the id in the query string:

| web | native |
|---|---|
| `/products/abc` | `/products/view/?id=abc` |
| `/messages/c1` | `/messages/view/?conversationId=c1` |
| `/browse/womenswear/clothing` | `/browse/view/?slug=womenswear%2Fclothing` |

Both resolve to the *same* component — the sibling is a 3-line re-export and must
never hold logic. Three pieces make it work:

- **`src/lib/platform/routes.ts`** — the rule table and `toNativeHref()`. Order
  matters: `/products/[id]/edit` is tested before `/products/[id]`, or `edit`
  becomes the id. Translation is idempotent on purpose.
- **`NativeRouteBridge`** (root layout) — rewrites links in the **capture** phase
  of a click, so the ~60 existing `<Link href={`/products/${id}`}>` call sites
  work untouched. On web it attaches nothing.
- **`useRouteParams` / `useRouteParam`** — pages import the plural one aliased as
  `useParams`, so `params.id` bodies read from a path segment on web and a query
  value on device with no change.

For programmatic navigation to a dynamic route use **`useAppRouter()`** (imported
aliased as `useRouter`), which the click bridge cannot see.

**Adding a dynamic route? Three steps, and a test enforces the third:**
1. `page.tsx` must be a *server* wrapper exporting
   `generateStaticParams()` → `nativeOnlyStaticParams({ id: NATIVE_PLACEHOLDER })`,
   rendering the `'use client'` body from `client-page.tsx` inside `<Suspense>`.
   A file cannot carry both `'use client'` and `generateStaticParams`, and Next
   checks `prerenderRoutes.length > 0` — an empty array fails the build, which is
   why the native target emits one unreachable `__native__` placeholder page.
2. Add the rule to `ROUTE_RULES`.
3. Create the flat sibling. `src/__tests__/lib/platform-routes.test.ts` fails if a
   rule has no page behind it — otherwise the mistake only shows up as a blank
   screen on a device.

### Native gotchas

- Anything reading `useSearchParams()` needs a `<Suspense>` boundary or the
  export fails to prerender. This is why `/auth/login` and `/auth/signup` read
  `?next` on the client instead of from the server `searchParams` prop, which is
  always empty in an export.
- **Server Actions do not exist in a static export.** `src/app/sell/actions.ts`
  was one and is now a plain module. New server-side work goes in `src/app/api/`,
  which the app can reach; a Server Action it cannot.
- `capacitor.config.ts` `appId` (`com.marigoapp.app`) is **permanent** once a
  build reaches App Store Connect or the Play Console.
- Next prefetches RSC payloads for untranslated hrefs and 404s on them. Harmless:
  the WebView origin is local, so it costs no network.
- Don't show web-install prompts in the app — `DownloadAppBanner` bails on
  `isNativeApp()`.
