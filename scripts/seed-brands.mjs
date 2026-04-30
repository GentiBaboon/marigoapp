import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { existsSync } from 'fs';

// Try service account file first, then ADC, then env var
let app;
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

if (saPath && existsSync(saPath)) {
  app = initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))), projectId: 'marigoappcom-v10-6377709-d8775' });
} else if (saEnv) {
  app = initializeApp({ credential: cert(JSON.parse(Buffer.from(saEnv, 'base64').toString())), projectId: 'marigoappcom-v10-6377709-d8775' });
} else {
  app = initializeApp({ credential: applicationDefault(), projectId: 'marigoappcom-v10-6377709-d8775' });
}

const db = getFirestore(app);

const brands = [
  "Abercrombie & Fitch", "Acne Studios", "Adidas", "AKOMA", "Alaia",
  "Alexander McQueen", "ALO", "Alviero Martini", "And Other Stories", "Anna Dani",
  "Armani", "ArtAntic", "ASOS", "Atmosphere",
  "Balenciaga", "Balmain", "Bata", "Benny Official", "Bershka",
  "Bottega Veneta", "Burberry",
  "Calvin Klein", "Calvin Klein Jeans", "Calzedonia", "Carpisa", "CASIO",
  "Céline", "Chanel", "Chiara Ferragni", "Chloé", "Christian Louboutin",
  "Coach", "Cohls", "Columbia", "Crocs", "Custom Made",
  "Diesel", "Dior", "Dixie", "DKNY", "Dolce&Gabbana", "Dsquared2",
  "Emporio Armani",
  "Fashion Nova", "Fendi", "Forever 21", "Fracomina",
  "Ganni", "Gant", "Givenchy", "Gucci", "Guess",
  "H&M", "Hermès", "HUGO", "Hugo Boss",
  "Illyrian Bloodline",
  "Jacquemus", "Jaded London", "Jimmy Choo", "Just Cavalli",
  "Kendall & Kylie",
  "Le Ger", "Levi's", "Loewe", "Lollipops", "Longchamp", "Louis Vuitton", "Love Moschino",
  "Mango", "Marella", "Massimo Dutti", "Max Mara", "MAX&Co", "Maybach",
  "Meshki", "Michael Kors", "Miss Sixty", "Missoni", "Missy Empire",
  "Miu Miu", "Mochy", "Motivi",
  "Nakd", "Nike", "No Label ( Vintage )",
  "OBAG", "Off-white", "Other", "OVS", "OYSHO",
  "Parfois", "Pepe Jeans", "Peppermayo", "Philipp Plein", "Pieces",
  "Pierre Cardin", "Pinko", "Prada", "Pretty Little Thing", "Primadonna",
  "Primark", "Pull and Bear", "Puma",
  "Ralph Lauren", "Reebok", "Replay", "Richmond", "River Island", "Rocco Barocco",
  "Saint Laurent", "Salvatore Ferragamo", "Savage X Fenty", "Sisley",
  "Skechers", "Skims", "Steve Madden", "Stradivarius",
  "Tally Weijl", "Tezenis", "The Shimmer Brand", "Tommy Hilfiger",
  "Trinjaket", "Trussardi", "Twinset",
  "Ugg", "United Colors of Benetton", "US POLO ASSN",
  "Vagabond", "Valentino", "Valentino Garavani", "Vero Moda",
  "Versace", "Versace Jeans", "Vintage", "Wolford",
  "Yamamay", "Yves Saint Laurent",
  "ZARA"
];

function slugify(name) {
  return name.toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function seedBrands() {
  // Get existing brands to avoid duplicates
  const existing = await db.collection('brands').get();
  const existingNames = new Set(existing.docs.map(d => d.data().name?.toLowerCase()));
  console.log(`Found ${existingNames.size} existing brands`);

  const toAdd = brands.filter(b => !existingNames.has(b.toLowerCase()));
  console.log(`Adding ${toAdd.length} new brands...`);

  const BATCH_SIZE = 400;
  for (let i = 0; i < toAdd.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toAdd.slice(i, i + BATCH_SIZE);
    for (const name of chunk) {
      const ref = db.collection('brands').doc();
      batch.set(ref, { name, slug: slugify(name), verified: false });
    }
    await batch.commit();
    console.log(`Committed batch of ${chunk.length}`);
  }

  console.log(`Done! Added ${toAdd.length} brands.`);
}

seedBrands().catch(err => { console.error(err); process.exit(1); });
