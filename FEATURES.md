# Marigo Admin — Features Log

## Admin Settings: Brands

- **Seeded 139 brands** from [marigoapp.com/brands](https://marigoapp.com/brands) into the Firestore `brands` collection
- Removed duplicate ("Dolce Gabbana" → kept "Dolce&Gabbana")
- Updated admin brands query to use `orderBy('name')` — brands are always displayed and stored in alphabetical order; any newly added brand automatically appears in the correct position

---

## Admin Settings: Categories

- **Seeded 14 parent categories and 113 subcategories** mirroring the full navigation structure of marigoapp.com:
  - **Clothes** — Coats, Trench Coats, Jackets, Jeans, Blazer, Trousers, Tops, Shirts & Blouses, Bodysuits, Kimono, Knitwear, Sweatshirts, Shirts, Polo Shirts, Pants, Dresses, Skirt, Flares, BBL Jacket, T-shirt
  - **Bags** — Handbags, Shoulder Bags, Totes, Crossbody Bags, Clutch Bags, Backpacks, Travel Bags, Satchels, Belt Bags
  - **Shoes** — Heels, Ballerina, Boots, Ankle Boots, Sandals, Espadrilles, Mules, Sneakers, Flat Shoes, Slippers, Trainers, Flats
  - **Gym & Sports Wear** — Tops & Bras, Leggings, Shorts, Sweatpants & Joggers, Hoodies & Sweatshirts, Boxers
  - **Accessories** — Sunglasses, Scarves, Hats, Gloves, Wallet, Belts, Purses, Cases, Ties
  - **Jewellery & Watches** — Rings, Watches, Bracelets, Necklaces, Earrings
  - **Clothing for Girls** — Dresses, Jackets & Outwear, Knitwear, Tops, Skirts, Shorts, Trousers, Hoodies & Sweats, Joggers & Cargos, Pyjama & Bodysuits
  - **Clothing for Boys** — Jackets & Outwear, Knitwear, Shorts, Trousers, Shirts & Blouses, Hoodies & Sweats, Joggers & Cargos, Socks, Pyjama
  - **Baby** — Outfits, Knitwear, Tops, Pyjamas & Bodysuits, Foot Wear, Outwear, Baby Accessories, Tools & Toys, For Mums
  - **Children's Accessories** — Bags & Cases, Belts, Hats, Gloves & Scarves, Jewellery, Sunglasses
  - **Beauty & Skincare** — Makeup, Skin Care, Hair Care, Body Care, Beauty Bags & Cases
  - **Home** — Decor, Fragrances, Furniture, Kitchen, Bedroom
  - **Art** — Poster, Paintings

- Added `order` field to `FirestoreCategory` type
- **Category reordering in admin** — new `CategoryConfigTab` component (`src/components/admin/settings/category-config-tab.tsx`) with:
  - Up/down arrow buttons to reorder parent categories
  - Up/down arrow buttons to reorder subcategories within each parent
  - Add subcategory directly from parent row
  - Edit and delete per item
  - Order persists to Firestore instantly on each move
- **Frontend respects order** — `CategoryStep.tsx` (sell flow) and `CategoriesSection.tsx` (homepage) both sort by `order` field client-side
- Admin categories query uses `orderBy('order')` for correct display

### Parent category display order
1. Clothes
2. Bags
3. Shoes
4. Gym & Sports Wear
5. Accessories
6. Jewellery & Watches
7. Clothing for Girls
8. Clothing for Boys
9. Baby
10. Children's Accessories
11. Beauty & Skincare
12. Home
13. Art

---

## Admin Settings: Attributes — Patterns

- **Seeded 92 patterns** across 10 groups:
  - Classic Prints (Solid/Plain, Striped, Pinstripe, Gingham, Houndstooth, Argyle, Polka Dot, etc.)
  - Floral & Botanical (Floral, Paisley, Tropical, Leaf Print, Toile, etc.)
  - Animal & Nature (Leopard, Zebra, Snake, Tiger, Cow Print, Butterfly, etc.)
  - Geometric (Abstract, Ikat, Aztec/Tribal, Mosaic, Damask, Batik, etc.)
  - Camouflage (Military Camo, Urban Camo, Digital Camo)
  - Texture-Based (Ribbed, Waffle, Quilted, Pleated, Laser Cut, Broderie Anglaise, etc.)
  - Artistic & Graphic (Graphic Print, Tie-Dye, Ombré, Color Block, Patchwork, etc.)
  - Cultural & Specialty (Bandana, Liberty Print, Conversational Print, etc.)
  - Embellishment (Embroidered, Beaded, Sequined, Woven Jacquard, Brocade, etc.)
  - Denim Specific (Distressed, Washed, Acid Wash, Raw, Faded, Patchwork Denim)

---

## Admin Settings: Attributes — Materials

- **Seeded 107 materials** (103 new + 4 existing: Cotton, Nylon, Leather, Synthetic) across 12 groups:
  - Natural Fabrics (Organic Cotton, Linen, Silk, Wool, Merino Wool, Cashmere, Alpaca, Hemp, Bamboo, etc.)
  - Synthetic Fabrics (Polyester, Spandex/Elastane, Viscose/Rayon, Modal, Lyocell/Tencel, Microfiber, Fleece, etc.)
  - Blended Fabrics (Cotton-Polyester, Cotton-Spandex, Wool-Polyester, Silk-Satin, Linen-Cotton)
  - Denim & Canvas (Denim, Raw Denim, Stretch Denim, Canvas, Twill, Chambray, Corduroy)
  - Technical & Performance (Gore-Tex, Ripstop, Neoprene, Mesh, Piqué, Waterproof/Breathable Fabric)
  - Leather & Animal-Derived (Full-Grain, Top-Grain, Genuine, Nubuck, Suede, Patent, Shearling, Fur)
  - Vegan & Sustainable Leather (Vegan Leather, PU Leather, Pineapple Leather, Mushroom Leather, Cork, etc.)
  - Knit (Ribbed, Cable, Jersey, Waffle, Fine, Chunky Knit)
  - Specialty & Luxury (Velvet, Satin, Chiffon, Organza, Tulle, Lace, Brocade, Jacquard, Tweed, Bouclé)
  - Hard / Structural (Acetate, Metal, Resin, Polycarbonate, Wood, Rattan/Wicker, Crystal/Rhinestone, Ceramic, etc.)
  - Shoe-Specific (EVA Foam Sole, Rubber Sole, Crepe Sole, Memory Foam, Rope/Espadrille, Raffia)
  - Recycled & Eco (Recycled Polyester, Recycled Nylon, Recycled Cotton, Upcycled Fabric, Econyl)

---

## Admin Settings: Attributes — Colors

- **Seeded 97 colors** (93 new + 4 existing: Yellow, Red, Green, Black) each with an accurate **hex value** for color preview circles, across 9 groups:
  - Neutrals (White, Off-White/Cream, Ivory, Beige, Sand, Ecru, Nude, Taupe, Khaki, Grey, Charcoal, Black)
  - Browns & Earthy (Brown, Chocolate, Terracotta, Clay, Earth, Mocha)
  - Blues (Light Blue, Sky Blue, Baby Blue, Cornflower Blue, Royal Blue, Cobalt, Navy, Midnight Blue, Teal, Turquoise, Petrol, etc.)
  - Greens (Mint, Sage, Olive, Moss Green, Forest Green, Emerald, Bottle Green, Lime Green, Neon Green)
  - Reds & Pinks (Light Pink, Blush, Rose, Dusty Rose, Mauve, Hot Pink, Fuchsia, Coral, Scarlet, Cherry, Burgundy, Wine, Bordeaux, Raspberry)
  - Yellows & Oranges (Cream Yellow, Pale Yellow, Mustard, Gold, Amber, Orange, Burnt Orange, Apricot, Peach)
  - Purples (Lavender, Lilac, Violet, Purple, Plum, Indigo)
  - Metallics & Special (Silver, Bronze, Copper, Rose Gold, Gunmetal, Holographic, Iridescent, Glitter, Metallic)
  - Multicolor / Other (Multicolor, Color Block, Tie-Dye, Ombré, Transparent/Clear, Translucent)

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/types.ts` | Added `order?: number` to `FirestoreCategory` |
| `src/app/admin/settings/page.tsx` | Brands `orderBy('name')`, categories `orderBy('order')`, replaced inline categories tab with `CategoryConfigTab` |
| `src/components/admin/settings/category-config-tab.tsx` | **New** — reorderable category tree with up/down arrows, add/edit/delete |
| `src/components/sell/steps/CategoryStep.tsx` | Sort parents and subcategories by `order` field |
| `src/components/home/CategoriesSection.tsx` | Sort category tabs by `order` field |
| `scripts/seed-brands.mjs` | Utility script for bulk brand seeding via firebase-admin |
