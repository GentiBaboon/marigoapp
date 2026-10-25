# App Store listing — Marigo (iOS)

Copy and answers for **App Store Connect → Apps → Marigo**. Nothing here lives
in the binary; these fields are edited in App Store Connect only. Companion to
`docs/store-release.md` (build and signing) and `docs/play-store-listing.md`.

Account: **xheni@marigoapp.com**, team `6AF53HFAKG` (Individual — the store
shows the seller as "Xheni Maloku").

Every claim below matches the live app: cash on delivery only (cards are off,
`CARD_PAYMENTS_ENABLED`), prices in lek or euro, listings reviewed before they
go live, the AI listing assistant and the Marigo chat assistant. Do not add
card/escrow wording back until cards return — Apple rejects listings that
describe features the reviewer cannot find (2.3.1).

---

## 1. New App (the "+" in My Apps)

| Field | Value |
|---|---|
| Platform | iOS |
| Name | `Marigo - Fashion Marketplace` (28/30) |
| Primary language | English (U.S.) |
| Bundle ID | `com.marigoapp.marigo` |
| SKU | `marigo-ios-001` (internal, never shown) |
| User access | Full access |

The home-screen label stays **MarigoApp** (`CFBundleDisplayName`); the store
name is set here and may differ from it.

## 2. App Information

| Field | Value |
|---|---|
| Subtitle (30) | `Buy & sell pre-loved designer` (29) |
| Category | Primary **Shopping**, secondary **Lifestyle** |
| Content rights | Contains third-party content: **Yes** — sellers upload their own photos and text |
| Age rating | **18+** (19+ Korea). Questionnaire as in §5, then *Override to Higher Age Rating* |

## 3. Version 1.0 — Product page

### Promotional text (170, editable without a new build)
```
Find designer bags, shoes and clothing from closets across Albania. List your own pieces in minutes with the AI listing assistant and pay cash on delivery.
```

### Description (4000)
```
Marigo is the marketplace for pre-loved designer fashion in Albania. Buy pieces from real closets, sell the ones you no longer wear, and pay cash when the parcel reaches your door.

BUY
Browse bags, shoes, clothing, jewellery and accessories from local sellers. Filter by category, brand, size, colour, material, condition and price, save pieces to your favourites and come back to them later. See prices in Albanian lek or euro.

MAKE AN OFFER
When a seller accepts offers, send your price and negotiate inside the app. Every counter-offer and reply is kept with the item, so you always know whose turn it is.

SELL IN MINUTES
Add a few photos and a short hint like "Zara black satin dress" and the AI listing assistant drafts the title, description, category, colour and details for you. Check it, set your price — with a suggested price range to guide you — and publish. Prefer to do it yourself? The step-by-step listing flow walks you through photos, category, description, details, pricing and review.

EVERY LISTING REVIEWED
New listings are checked by the Marigo team before they go live.

DELIVERY AND CASH ON DELIVERY
Orders are collected from the seller and delivered to your address, with the delivery fee shown before you place the order. Pay cash when the parcel arrives, and follow every order from preparation to delivery.

GET PAID
Track views, offers and sales from your profile. Once an order is completed and settled, your earnings appear in your wallet, ready to withdraw to your bank account.

ALSO INSIDE
- Messages between buyers and sellers
- Marigo, the AI shopping assistant, to find items and answer questions about buying and selling
- Notifications for offers, messages and order updates
- Sign in with Apple, Google or email

Marigo is based in Tirana, Albania.
```

### Keywords (100, comma-separated, no spaces after commas)
```
preloved,second hand,preowned,luxury,resale,vintage,closet,clothes,bags,shoes,outfit,thrift,albania
```
Don't repeat words from the name or subtitle (Apple indexes those already), and
never list brand names — that is a 2.3.7 rejection.

### URLs
| Field | Value |
|---|---|
| Support URL | `https://www.marigoapp.com/help` |
| Marketing URL | `https://www.marigoapp.com` |
| Privacy Policy URL | `https://www.marigoapp.com/privacy` |
| Copyright | `2026 Xheni Maloku` |

### Screenshots
Since late 2026 App Store Connect's **required** slot is *iPhone with Dynamic
Island (medium display)*, the 6.1"/6.3" size (1206×2622 or 1179×2556). The 6.9"
"large display" slot is optional. Both sets, alpha removed, are on the Desktop
in `marigo-app-store-screenshots-upload/`:

- `6.3-inch-required (1206x2622)/`: resampled from the originals; the aspect ratio differs by 0.06%
- `6.9-inch-optional (1320x2868)/`: the originals from `marigo-app-store-screenshots.zip`

They're found under Version → **App Previews and Screenshots** (the page opens on
"Header and Search Results", which only takes wide banner art; switch with the
dropdown). Upload in this order, since the first three show in search results:

1. `01-hero` · 2. `03-ai-listing` · 3. `02-deals` · 4. `04-ai-assistant` ·
5. `05-offers` · 6. `06-details` · 7. `08-checkout` · 8. `07-earnings`

Apple scales the required set to the other iPhone sizes. **No iPad set is needed**: the app ships iPhone-only
(`TARGETED_DEVICE_FAMILY = 1`). A universal build would make 13" iPad
screenshots mandatory. iPad support can be added in a later version, but once
it has shipped it can never be removed.

### App icon
Taken from the binary (`AppIcon-512@2x.png`, 1024², alpha removed — an icon
with an alpha channel fails the upload with ITMS-90717).

## 4. App Review Information

| Field | Value |
|---|---|
| Sign-in required | Yes |
| Demo account | A **dedicated** password account with confirmed email, a saved address, one listing and one order, so the reviewer can reach checkout, selling and messages without the 6-digit email code. Never use a staff/admin account. |
| Contact | Xheni Maloku · hello@marigoapp.com · phone |

### Notes (paste)
```
Marigo is a marketplace for physical second-hand fashion items. Payment is cash on delivery to the courier, so no in-app purchase applies (guideline 3.1.5(a): physical goods and services consumed outside the app).

Demo account: see the credentials above. It is already email-verified, has a saved address and an existing order.

Selling: tap Sell, choose "List with AI Assistant", add 3 photos and a short hint; the draft opens on the Review step. New listings go to manual review before they appear publicly.

Account deletion: Me > Settings > Danger Zone > Delete Account (type DELETE). This deletes the profile and the sign-in account.

User-generated content: members accept chat rules before their first message. In any conversation, the menu (three dots, top right) has Report and Block. Blocking stops both members from messaging each other. Reports go to our moderation queue.

Sign in with Apple and Google are offered on the sign-in screen.
```

## 5. App Privacy questionnaire

It must match `ios/App/App/PrivacyInfo.xcprivacy` and `/privacy`. Apple
compares them.

**Tracking: No.** No data is used for tracking.

Collected, **linked to the user**, purpose **App Functionality** unless noted:

| Category | Type |
|---|---|
| Contact Info | Name, Phone Number, Physical Address. **Email Address** also gets *Developer's Advertising or Marketing* (the footer newsletter) |
| Financial Info | Payment Info (seller bank details for withdrawals) |
| User Content | Photos or Videos (listing photos), Customer Support (Marigo assistant transcripts in `support_chats`), Other User Content (messages, listings) |
| Identifiers | User ID, Device ID (push token) |
| Purchases | Purchase History |
| Search History | Search History |
| Usage Data | Product Interaction: App Functionality, **Analytics** and **Product Personalization** (recommendations from viewed items) |

No crash reporting or ad SDK is wired (`error-reporter.ts` only logs), so
Diagnostics stays unticked. **Entered in App Store Connect on 2026-10-25 but
not yet published.** Publishing asks the account holder to attest the answers
are accurate.

**Other User Content** (messages and listing text) is not in the privacy
manifest yet. Declare it here anyway. A buyer↔seller chat is user content, and
under-declaring is the riskier mistake.

### Age rating answers
User-generated content: **Yes**. Messaging and chat: **Yes**. Unrestricted
web access: **No**. Everything else (violence, gambling, mature themes and so
on): **None**. Apple calculates 4+ from that, but `/terms` requires members to
be at least 18 and `/privacy` says "Marigo is for adults", and Apple requires
the rating to match a minimum age in the terms, so it is **overridden to 18+**.
Keep the two in step if the terms ever change.

---

## Submitted

**Version 1.0.0 (build 2) was submitted to App Review on 2026-10-25** and is
*Waiting for Review*. Price Free, available in all 175 regions (Apple's
default; narrow it under Pricing and Availability). The demo account is
genti.selenica@gmail.com. Its password is in App Store Connect, not here.

Open item: App Information lists Marigo as a DSA **non-trader**. A business
selling to EU consumers normally declares trader status (business address and
phone shown on the listing), which decides whether the app stays available in
the EU.

## 6. Before pressing "Submit for Review"

- [ ] Build uploaded and processed (TestFlight tab shows it), then selected in the version's **Build** section
- [ ] Export compliance is answered by `ITSAppUsesNonExemptEncryption = false` in `Info.plist`, so it won't be asked
- [ ] Firestore rules deployed (`firebase deploy --only firestore:rules`), or in-app account deletion fails with a permission error in front of the reviewer
- [ ] Demo account signs in on a real device
- [x] A build containing Report/Block is the one selected (build 2, attached 2026-10-25; build 1 predates it)
- [ ] Pricing and Availability: Free. Choose the countries (Albania, Kosovo, Italy, and any others)
