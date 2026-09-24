# Marigo App — Feature Changelog

## Session: September 2026

---

### 1. Seller payouts — bank transfer, gated on the cash arriving
- **New module `src/lib/payouts.ts`** holds every payout decision: the floor,
  what counts as settled, the balance split, whether a withdrawal is allowed,
  IBAN validation. 29 unit tests
- **`orders.cashSettledAt`** — completed means the buyer has the parcel; this
  means the cash reached Marigo through the courier. Only the second releases a
  seller's earnings. Admin-only in `firestore.rules`, carved out of the broad
  party branch so a seller cannot stamp their own order
- Orders completed before **2026-09-15** are grandfathered as settled, so no
  existing seller's balance dropped to zero. They show as "Assumed received"
  with a button to put a real confirmation on the record
- **5.000 ALL minimum**, on the seller's own money after commission, derived
  from `ALL_PER_EUR` rather than restated in euro
- **`payout_requests` collection** — the seller files one with their bank
  details (kept on the request, not on the world-readable user document);
  `isFullAdmin()` reads and decides
- **`/admin/payouts`** — the withdrawal queue: copy buttons per field, approve,
  mark paid with a reference (writes the `transactions` ledger row and notifies
  the seller), or decline with a reason
- New permission `payouts.manage` — admin and super_admin only, matching the
  rules
- Verified end to end against real Firestore: create → approve → mark paid →
  ledger → notification → the seller's wallet showing 5.580 ALL for a €60 payout

### 2. Stripe payout onboarding switched off
- `STRIPE_ONBOARDING_ENABLED` in `src/lib/payment-options.ts`. Connect needs a
  connected account and a captured card balance; cards are off and the Connect
  functions cannot be invoked (org policy), so the payout button threw for every
  seller who pressed it
- `/profile/stripe-onboarding` redirects to the wallet; the route answers 403 —
  the UI is not the guard. "Setup Payouts (Sellers)" removed from the profile
  menu. Nothing deleted

### 3. Seller wallet rebuilt
- Available / pending / withdrawn, with "How you get paid" behind a disclosure
  on the "Available to withdraw" box
- The withdraw button is always present and pressable; below the floor the
  dialog explains how far off you are rather than showing fields that cannot
  submit
- The completed step of the seller order timeline now hands over to the wallet
  instead of promising a payout nobody was processing

### 4. Wishlist had no way in
- Heart in the header between Messages and Cart (desktop; a fifth icon overlaps
  the logo at 375px), **My Favourites** in the profile menu and the account
  dropdown for the phone
- The bottom `MobileNav` never had a Favourites entry, contrary to what the docs
  said — `/favorites` was reachable only by typing the URL
- Product page: a labelled "Add to wishlist" / "In wishlist" button replacing the
  unlabelled heart beside the title

### 5. Product view counts
- Repeat visits by the same shopper now count, throttled to **once an hour** per
  listing per browser (`src/lib/view-throttle.ts`). The old guard was a permanent
  `sessionStorage` flag, so a second visit never counted
- Signed-out visitors still do not count — `views` is gated on `isActiveUser()`

### 6. Smaller fixes
- **"My Sales"** in the profile menu and account dropdown, pointing at the Sold
  tab of `/profile/listings` — already the seller's order list, with no way in
- The buyer order page's **Help centre button was unreachable**, not broken: the
  page had no bottom padding, so its last element sat under the fixed
  `MobileNav`. `pb-28 md:pb-8`
- **"No longer needed" removed** from the refund reasons — changing your mind is
  a cancellation, which runs before the item ships
- **Packing instructions** replaced with the team's own four numbered steps
- **Help Centre and the assistant corrected**: the order stages were the card
  flow ("pending payment → processing"), the refund answer described releasing a
  card authorisation, and the assistant contradicted itself about an escrow hold
  that does not exist on a cash order

---

## Session: April 2026

---

### 1. Shopping Preference Modal — Text Only
- Removed icons from the Womenswear / Menswear preference buttons
- Buttons now display label text only

---

### 2. Logo & Branding
- Added `/public/logo.png` (full wordmark) and `/public/app-icon.png` (square icon)
- **Header**: replaced `marigo` text with `logo.png` image (`brightness-0` = black)
- **Footer**: replaced `marigo` text with `logo.png` image (black)
- **Auth / Sign-up page**: logo displayed in white (`brightness-0 invert`) on dark background
- **Favicon**: `app-icon.png` set as browser tab icon and Apple touch icon in `layout.tsx`
- **App download banner**: replaced old orange "V" icon with `app-icon.png` (purple `m` logo)

---

### 3. AI Chat (MarigoAI) — Mobile Hide & Help Center Access
- Floating chat button hidden on mobile (`hidden md:inline-flex`)
- Help Center page (`/help`) now has a "Start a conversation" button that opens the chatbot via a custom browser event (`open-chatbot`)
- `ChatbotWidget` listens for the `open-chatbot` event to open from any page

---

### 4. Homepage — MacroFilters
**Display (`/src/components/home/MacroFilters.tsx`):**
- Reads `settings/macro_filters` from Firestore
- Renders only enabled filters as wide rectangular bordered buttons (uppercase, `font-body`, `tracking-widest`)
- Active filter highlighted; clicking toggles `/home?macroFilter={id}`
- Positioned above the "First Time?" section

**Admin (`/src/components/admin/settings/macro-filters-tab.tsx`):**
- Add / edit / delete custom MacroFilters
- Toggle each filter visible/hidden on homepage
- Tag products and members to each filter (Firestore search)
- Save persists to `settings/macro_filters`

---

### 5. Homepage — Configurable Image Blocks
**Display (`/src/components/home/HomepageBlocks.tsx`):**
- Reads `settings/homepage_blocks` from Firestore
- Each block displays in **16:9** aspect ratio
- Title and subtitle overlaid at **bottom-left** inside the image with a dark gradient
- Multiple images (2–3) shown as a **swipe carousel** with dot indicators
- Swipe left/right on mobile; tap dots to jump; swipe does not trigger link navigation
- Backward compatible with legacy single-image blocks

**Admin (`/src/components/admin/settings/homepage-blocks-tab.tsx`):**
- Add / edit / delete blocks; reorder with up/down arrows; toggle visible/hidden
- **1–3 images per block** with individual upload slots
- **Drag-and-drop image uploader** with click-to-browse fallback
- **Focal point repositioning**: drag the purple dot or click anywhere on the image preview to set where `object-position` centers (no toggle required — always active)
- **Title** and **Subtitle** fields
- **URL** field for click-through destination
- Visible on Homepage toggle
- Publish button saves all blocks to Firestore

**Upload API (`/src/app/api/admin/upload/route.ts`):**
- Admin-only endpoint — verifies Firebase ID token, checks `role` in Firestore `users` collection
- Uses Firestore REST API (no Firebase Admin SDK / service account key required)
- Uploads to Supabase Storage bucket `MARIGO_BUCKED` under `settings/blocks/`
- Client-side image compression to JPEG ≤1600px before upload (avoids size limit errors)
- Returns public URL

---

### 6. Search & Filtering — Full Rewrite
**`/src/app/search/page.tsx`:**
- Reads all URL params: `gender`, `category` (subcategoryId), `categoryId` (parent), `brand`, `size`, `color`, `condition`, `material`, `pattern`, `minPrice`, `maxPrice`, `q`, `section`
- **Firestore query strategy**: filter by `status == active` + `subcategoryId` (when present) using existing composite indexes; all other filters applied client-side
- Resolved slug → stored name for `brand` and `categoryId` (products store brand/parent-category by name, not slug)
- **Active filter chips** shown above results with × to remove each
- **Filter count badge** on Filters button
- **Filter Sheet** (bottom drawer) with pills/swatches for all attributes loaded live from Firestore: Gender, Category, Subcategory, Brand, Condition, Color, Material, Pattern, Price range
- **Error handling** with `.catch()` on Firestore queries (was previously silent failures)

**`/src/app/browse/[...slug]/page.tsx`:**
- Replaced static mock-data category lists with **live Firestore categories**
- Subcategory links now use actual Firestore slugs (fixes slug mismatch that caused zero results)
- Brand links loaded from Firestore `brands` collection

**`firestore.indexes.json`:**
- Added composite index `(status, gender, listingCreated)`
- Added composite index `(status, gender, subcategoryId, listingCreated)`
- Added composite index `(status, isFeatured, listingCreated)`
- Deploy: `firebase deploy --only firestore:indexes --project marigoappcom-v10-6377709-d8775`

---

### 7. Firestore Security Rules
- Added public read for `settings/banners`, `settings/macro_filters`, `settings/homepage_blocks`
- `FirebaseErrorListener` suppresses non-fatal permission errors on `/settings/` paths to avoid React error boundaries triggering on public pages before rules propagate

---

### 8. Data Notes
Firestore products store fields as follows (important for querying):
| Field | Stored as |
|---|---|
| `gender` | slug: `"women"`, `"men"`, `"children"`, `"unisex"` |
| `subcategoryId` | Firestore category slug e.g. `"shoulder-bag"` |
| `categoryId` | Parent category **name** e.g. `"Bags"` |
| `brandId` | Brand **name** e.g. `"Dolce Gabbana"` |
| `condition` | Attribute value string |
| `material` | Attribute value string |
| `color` | Attribute value string |
| `pattern` | Attribute value string |
