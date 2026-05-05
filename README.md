# Marigo

Marigo (a.k.a. **Marigo Luxe**) is a Next.js + Firebase marketplace for pre-owned luxury fashion, targeting buyers and sellers across Albania, Italy, and the wider EU. Buyers browse and purchase authenticated designer items; sellers list products through a guided wizard with AI-assisted pricing.

---

## Tech stack

| Layer | Stack |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript 5 |
| UI | shadcn/ui (Radix UI + Tailwind CSS), Lucide, Framer Motion |
| State | React Context (Cart, Wishlist, Currency, Language, Shopping Preference) |
| Forms | react-hook-form + Zod |
| Auth | Firebase Auth (custom claims for admin / super_admin / moderator) |
| Database | Firestore |
| Image storage | Supabase Storage |
| Payments | Stripe (via Firebase Cloud Functions) |
| Email | Mailtrap |
| AI | Google Genkit (`@genkit-ai/google-genai`) — pricing suggestions, support chat |
| Tables / charts | TanStack Table, Recharts |
| Hosting | Vercel (web), Firebase (functions, Firestore) |

---

## Features

**Storefront**
- Homepage with category tree, new arrivals, personalized picks, configurable macro filters, and a 16:9 carousel of homepage blocks
- Category browsing (`/browse/[...slug]`) backed by a live Firestore category tree (14 parents, 113+ subcategories)
- Search (`/search`) with URL-driven filters: gender, category, brand, size, color, condition, material, pattern, price range, free-text
- Product detail pages, wishlist, recently viewed, shopping-preference modal (Womenswear / Menswear / Unisex)

**Selling**
- Multi-step listing wizard: category → images → details → pricing (with AI suggestion) → review & publish
- Draft auto-save and edit-listing flow that mirrors the sell wizard
- Seller dashboard, sales orders, payouts

**Buying**
- Cart with Firestore sync for signed-in users
- Multi-step checkout: address → payment (Stripe) → review → success
- Buyer order history, order detail, returns, disputes

**Messaging & notifications**
- Real-time buyer ↔ seller chat (Firestore `onSnapshot`, typing indicators, read state)
- In-app notifications collection

**Admin panel** (`/admin`)
- Orders, products, users, finance / payouts, refunds, returns, disputes, logistics, moderation, marketing
- Settings: brand catalog (139 seeded), category tree with reorder UI, attributes (patterns / materials / colors with hex), macro filters, homepage blocks, banners

**AI**
- Price suggestion for sellers
- MarigoAI support chat

---

## Project structure

```
src/
├── app/                  # Next.js App Router
│   ├── home/             # Landing page sections
│   ├── browse/[...slug]/ # Category browsing
│   ├── search/           # Faceted search
│   ├── products/[id]/    # Product detail
│   ├── sell/             # Listing wizard
│   ├── cart/             # Cart UI
│   ├── checkout/         # Checkout wizard + success
│   ├── messages/         # Buyer/seller chat
│   ├── profile/          # Account, orders, listings, sales
│   ├── admin/            # Admin panel (orders, products, settings, …)
│   ├── auth/             # Sign in / sign up / reset
│   ├── help/             # Support center
│   └── api/              # Route handlers (create-order, payment, upload, ai, chat)
├── components/           # Reusable UI (home, admin, sell, checkout, profile, ui)
├── context/              # Cart / Wishlist / Currency / Language providers
├── firebase/             # Client config, auth, error handling, hooks
├── lib/                  # Types, admin SDK, mailtrap, notifications, utils
├── services/             # Business-logic services
├── ai/                   # Genkit chat & pricing
├── hooks/                # Custom React hooks
└── __tests__/            # Vitest suites

functions/                # Firebase Cloud Functions (Stripe, order creation, email)
firestore.rules           # Firestore security rules
firestore.indexes.json    # Composite index definitions
```

Path alias: `@/*` → `./src/*`.

---

## Getting started

### Prerequisites
- Node.js 20.x (`.nvmrc` / launch.json target `v20.20.2`)
- A Firebase project (Auth + Firestore + Functions)
- Supabase project (Storage)
- Stripe account (test keys are fine for local dev)

### Install

```bash
npm install
cd functions && npm install && cd ..
```

### Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
# Firebase web config
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION=europe-west1

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=

# Supabase (image storage)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
GOOGLE_GENAI_API_KEY=

# Email
MAILTRAP_TOKEN=

# Misc
RESET_SERVICE_SECRET=
```

### Run

```bash
npm run dev          # Next.js on http://localhost:3001
```

Optional, in a second terminal:

```bash
cd functions && npm run serve   # Firebase Functions emulator on :5001
```

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server (port 3001) |
| `npm run build` | Production build + sitemap generation |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (single run) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | Playwright E2E suite |

Inside `functions/`:

| Command | Purpose |
|---|---|
| `npm run build` | Compile TypeScript |
| `npm run serve` | Run the Functions emulator |
| `npm run deploy` | Deploy Cloud Functions |

---

## Firebase

**Collections** (see [firestore.rules](firestore.rules))
- `users/{uid}` — profile, role, with subcollections `cart`, `wishlist`, `addresses`
- `products/{id}` — listings (status, gender, brandId, subcategoryId, price, images, seller info)
- `orders/{id}` — buyer orders with status timeline
- `conversations/{id}` — chat threads keyed by `participants` array
- `notifications/{id}` — in-app notifications
- `settings/*` — `brands`, `categories` (with subcategory subcollection), `attributes/{type}`, `macro_filters`, `homepage_blocks`, `banners`
- `admin_logs` — audit trail

**Composite indexes** (see [firestore.indexes.json](firestore.indexes.json)) cover the main search / browse / seller dashboard / chat queries — notably `(status, subcategoryId, listingCreated)` for category listings and `participants array-contains, lastMessageAt desc` for chat.

**Security rules** distinguish:
- `isAdmin()` — custom claim `admin: true` or role in `[admin, super_admin, moderator, analyst]`
- `isFullAdmin()` — `[admin, super_admin]`

Public read is allowed for `settings/banners`, `settings/macro_filters`, `settings/homepage_blocks`, and active products.

---

## Deployment

- **Web**: deployed to Vercel from `main`. Generates `sitemap.xml` and `robots.txt` via `next-sitemap` postbuild.
- **Functions / Firestore**: `firebase deploy --only functions,firestore:rules,firestore:indexes`.

---

## Further reading

- [FEATURES.md](FEATURES.md) — feature-level changelog and shipped capabilities
- [CHANGELOG.md](CHANGELOG.md) — release notes
- [docs/blueprint.md](docs/blueprint.md) — original product blueprint
