# Marigo App — Feature Changelog

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
