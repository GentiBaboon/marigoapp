/**
 * Give every listing a stored, unique `seoSlug`.
 *
 * Product URLs are `/products/{slug}`, which is resolved by querying `seoSlug`
 * — so a listing with no stored slug cannot be reached by a slug URL at all.
 * `buildProductPath` falls back to `/products/{id}` for those, meaning they
 * keep working but never get a readable URL. This fills the gap for everything
 * published before slugs existed.
 *
 * DRY RUN BY DEFAULT. Nothing is written until you pass --apply.
 *
 *   node scripts/backfill-slugs.mjs                # report
 *   node scripts/backfill-slugs.mjs --apply        # write
 *   node scripts/backfill-slugs.mjs --apply --force  # also rewrite existing slugs
 *
 * Auth matches scripts/seed-brands.mjs: GOOGLE_APPLICATION_CREDENTIALS, or
 * FIREBASE_SERVICE_ACCOUNT (base64), or application default credentials.
 *
 * Slug rules come from src/lib/product-slug.ts through jiti, so the script and
 * the app cannot disagree about what a listing's URL should be.
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));
// See scripts/generate-sitemap.mjs — jiti needs the tsconfig `@/*` alias.
const jiti = require('jiti')(ROOT, { alias: { '@': join(ROOT, 'src') } });
const { generateProductSlug, uniqueSlug } = jiti('./src/lib/product-slug.ts');

const PROJECT_ID = 'marigoappcom-v10-6377709-d8775';
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');

function initFirestore() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saPath && existsSync(saPath)) {
    return getFirestore(initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))), projectId: PROJECT_ID }));
  }
  if (saEnv) {
    return getFirestore(initializeApp({ credential: cert(JSON.parse(Buffer.from(saEnv, 'base64').toString())), projectId: PROJECT_ID }));
  }
  return getFirestore(initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID }));
}

async function main() {
  const db = initFirestore();
  const snap = await db.collection('products').get();

  console.log(`\nMode: ${APPLY ? 'APPLY (writes to Firestore)' : 'DRY RUN (no writes)'}`);
  console.log(`Scanned ${snap.size} products.\n`);

  // Slugs already in use, so the run cannot create a collision with an
  // untouched document or with an earlier document in this same pass.
  const taken = new Set();
  snap.forEach((d) => {
    const s = d.data().seoSlug;
    if (typeof s === 'string' && s) taken.add(s);
  });

  const writes = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const existing = typeof data.seoSlug === 'string' ? data.seoSlug.trim() : '';
    if (existing && !FORCE) continue;

    const base = generateProductSlug({
      id: doc.id,
      title: data.title,
      brandId: data.brandId,
      color: data.color,
      size: data.size,
    });
    if (!base) {
      console.log(`  · SKIP ${doc.id} — no title to build a slug from`);
      continue;
    }

    if (existing) taken.delete(existing);
    const slug = await uniqueSlug(base, async (c) => taken.has(c));
    taken.add(slug);

    if (slug === existing) continue;
    // Renaming rewrites a live URL. Keep the old slug so it still resolves —
    // it canonicals to the new one, which moves any ranking across instead of
    // dropping it.
    const history = Array.isArray(data.seoSlugHistory) ? data.seoSlugHistory : [];
    const nextHistory = existing && !history.includes(existing) ? [...history, existing] : history;
    writes.push({ ref: doc.ref, slug, history: nextHistory });
    console.log(`  · ${data.title ?? doc.id}`);
    console.log(`      ${existing || '(none)'}  ->  ${slug}`);
  }

  if (writes.length === 0) {
    console.log('\nEvery listing already has a slug. Nothing to do.\n');
    return;
  }
  if (!APPLY) {
    console.log(`\n${writes.length} listing(s) would get a slug. Re-run with --apply to write.\n`);
    return;
  }

  console.log(`\nWriting ${writes.length} slug(s)...`);
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    writes.slice(i, i + 450).forEach(({ ref, slug, history }) =>
      batch.update(ref, { seoSlug: slug, ...(history.length ? { seoSlugHistory: history } : {}) }),
    );
    await batch.commit();
  }
  console.log('Done. Redeploy so the sitemap picks up the new URLs.\n');
}

main().catch((err) => {
  console.error('\nFailed:', err?.message ?? err);
  process.exit(1);
});
