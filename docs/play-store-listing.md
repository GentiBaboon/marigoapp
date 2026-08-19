# Google Play store listing — Marigo

Copy for the Play Console **Store presence → Main store listing**. Nothing here
lives in the app binary; these fields are edited in the Console only.

## Why the app was rejected (versionCode 1)

Two Metadata-policy findings, both about listing text rather than the app:

1. **"Title matches description exactly"** — the description field contained
   only the string `Marigo Fashion Marketplace`, identical to the title.
2. **"Translated short and long description are the same"** — on the translated
   (Albanian) listing, the short description and the full description were the
   same text.

The rule is simply that **title, short description and full description must
each be different**, and each must actually describe the app. The copy below
satisfies that in both locales.

---

## English (en-US) — default listing

### App name (max 30)
```
Marigo: Luxury Fashion Resale
```

### Short description (max 80)
```
Buy and sell authenticated pre-owned designer fashion, with escrow protection.
```

### Full description (max 4000)
```
Marigo is a marketplace for authenticated pre-owned luxury fashion, serving Albania, Italy and the wider EU.

Every listing is reviewed before it goes live, and every order is paid through escrow — so both sides of the sale are protected.

BUY
Browse curated designer bags, shoes, clothing, jewellery and accessories from vetted sellers. Filter by category, brand, size, colour, material, condition and price to find exactly what you are looking for, save pieces to your favourites, and make an offer when a seller accepts them. Prices can be shown in Albanian lek, euro or US dollars.

SELL
List an item in six guided steps: add photos, choose a category, describe the piece, set its details and size, price it, then review and publish. If you would rather not write the listing yourself, the built-in assistant reads your photos and drafts the title, description, category and a suggested price for you to edit before publishing. Track views, offers and sales from your profile, and withdraw your earnings once an order completes.

DELIVERY
Orders are collected from the seller and delivered by Marigo's courier network, with a flat delivery fee shown at checkout. You can follow each order through pickup, transit and delivery from the order screen.

PAYMENT PROTECTION
Card payments are authorised at checkout and held in escrow. Funds are released to the seller only after the item has been delivered and the buyer's inspection window has passed. If something is wrong, you can open a return or a dispute and Marigo support will step in.

ALSO INSIDE
- Real-time messaging between buyers and sellers
- Size guides mapped to EU, UK, US, IT, FR and international charts
- An assistant that answers questions about stock, sizing and how selling works
- Notifications for offers, messages and order updates
- Available in English and Albanian

Marigo is based in Tirana, Albania.
```

---

## Albanian (sq) — translated listing

> Written for a native speaker to review before publishing. The important part
> is structural: these three fields are distinct from each other **and** from
> the English ones.

### App name (max 30)
```
Marigo: Modë Luksi e Përdorur
```

### Short description (max 80)
```
Bli dhe shit modë luksi origjinale të përdorur, me pagesa të mbrojtura.
```

### Full description (max 4000)
```
Marigo është një treg për modë luksi origjinale të përdorur, për Shqipërinë, Italinë dhe Bashkimin Evropian.

Çdo artikull kontrollohet përpara se të publikohet dhe çdo porosi paguhet përmes një sistemi të mbrojtur pagesash.

BLI
Shfleto çanta, këpucë, veshje, bizhuteri dhe aksesorë të markave të përzgjedhura nga shitës të verifikuar. Filtro sipas kategorisë, markës, masës, ngjyrës, materialit, gjendjes dhe çmimit, ruaj artikujt që të pëlqejnë te të preferuarat dhe dërgo një ofertë kur shitësi i pranon. Çmimet shfaqen në lekë, euro ose dollarë.

SHIT
Publiko një artikull në gjashtë hapa: shto fotot, zgjidh kategorinë, përshkruaj artikullin, plotëso detajet dhe masën, vendos çmimin dhe kontrollo përpara publikimit. Nëse nuk dëshiron ta shkruash vetë, asistenti lexon fotot dhe përgatit titullin, përshkrimin, kategorinë dhe një çmim të sugjeruar, të cilat mund t'i ndryshosh. Ndiq shikimet, ofertat dhe shitjet nga profili yt dhe tërhiq fitimet kur porosia përfundon.

DËRGESA
Porositë merren te shitësi dhe dorëzohen nga rrjeti i korrierëve të Marigo-s, me një tarifë fikse që shfaqet në arkë. Mund ta ndjekësh çdo porosi nga marrja te dorëzimi.

MBROJTJA E PAGESËS
Pagesa me kartë autorizohet në arkë dhe mbahet e bllokuar. Paratë i kalojnë shitësit vetëm pasi artikulli është dorëzuar dhe ka kaluar afati i kontrollit. Nëse diçka nuk shkon, mund të hapësh një kthim ose një ankesë dhe stafi i Marigo-s ndërhyn.

GJITHASHTU
- Mesazhe në kohë reale mes blerësit dhe shitësit
- Udhëzues masash për EU, UK, US, IT, FR dhe ndërkombëtare
- Një asistent që përgjigjet për stokun, masat dhe si funksionon shitja
- Njoftime për oferta, mesazhe dhe përditësime të porosive
- Në shqip dhe anglisht

Marigo ka bazën në Tiranë, Shqipëri.
```

---

## Checklist before resubmitting

- [ ] Title, short description and full description differ — **in every locale**
- [ ] No brand-name keyword lists ("gucci, chanel, prada …") in any field
- [ ] No testimonials or review quotes in the description
- [ ] Screenshots show the real app, with no added marketing text claiming
      features the app does not have
- [ ] Upload `app-release.aab` (versionCode 2) and submit for review
