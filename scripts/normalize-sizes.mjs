/**
 * Backfill sizes onto the canonical vocabulary.
 *
 * Two jobs, both idempotent:
 *   1. products     — `size` and every `variants[].size` folded through
 *                     normalizeSize() ("Small" → "S", "EU 38" → "38").
 *   2. size_charts  — the same fold over `sizes[]`, then dedupe and reorder
 *                     to the preset's ordering where one exists. This is what
 *                     removes the Home chart's Small/Medium/Large, which
 *                     otherwise splits the same inventory across two pills.
 *
 * DRY RUN BY DEFAULT. Nothing is written until you pass --apply.
 *
 *   node scripts/normalize-sizes.mjs                 # report only
 *   node scripts/normalize-sizes.mjs --apply         # write
 *   node scripts/normalize-sizes.mjs --only=charts   # products | charts | all
 *   node scripts/normalize-sizes.mjs --apply --backup=out.json
 *
 * Auth matches scripts/seed-brands.mjs: GOOGLE_APPLICATION_CREDENTIALS, or
 * FIREBASE_SERVICE_ACCOUNT (base64), or application default credentials.
 *
 * The normalisation rules are NOT duplicated here — they are loaded from
 * src/lib/size-options.ts through jiti, so the script and the running app can
 * never disagree about what "Small" means.
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// See scripts/generate-sitemap.mjs — jiti needs the tsconfig `@/*` alias.
const jiti = require('jiti')(process.cwd(), {
  alias: { '@': `${process.cwd()}/src` },
});
const { normalizeSize, SIZE_PRESETS } = jiti('./src/lib/size-options.ts');

const PROJECT_ID = 'marigoappcom-v10-6377709-d8775';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY = (args.find((a) => a.startsWith('--only=')) ?? '--only=all').split('=')[1];
const BACKUP = args.find((a) => a.startsWith('--backup='))?.split('=')[1];

const doProducts = ONLY === 'all' || ONLY === 'products';
const doCharts = ONLY === 'all' || ONLY === 'charts';

function initFirestore() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  let app;
  if (saPath && existsSync(saPath)) {
    app = initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))), projectId: PROJECT_ID });
  } else if (saEnv) {
    app = initializeApp({ credential: cert(JSON.parse(Buffer.from(saEnv, 'base64').toString())), projectId: PROJECT_ID });
  } else {
    app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  return getFirestore(app);
}

/** Reorder a chart's sizes to the preset order, appending anything off-preset. */
function orderLikePreset(sizes, categoryType, sizeSystem) {
  const preset = SIZE_PRESETS[categoryType]?.[sizeSystem];
  if (!preset?.length) return sizes;
  const rank = new Map(preset.map((s, i) => [s, i]));
  const known = sizes.filter((s) => rank.has(s)).sort((a, b) => rank.get(a) - rank.get(b));
  const unknown = sizes.filter((s) => !rank.has(s));
  return [...known, ...unknown];
}

async function backfillProducts(db, changes) {
  const snap = await db.collection('products').get();
  let scanned = 0;
  const writes = [];

  snap.forEach((doc) => {
    scanned += 1;
    const data = doc.data();
    const update = {};

    const before = data.size;
    if (typeof before === 'string' && before.trim()) {
      const after = normalizeSize(before);
      if (after && after !== before) update.size = after;
    }

    if (Array.isArray(data.variants) && data.variants.length > 0) {
      let touched = false;
      const nextVariants = data.variants.map((v) => {
        if (!v || typeof v.size !== 'string') return v;
        const after = normalizeSize(v.size);
        if (after && after !== v.size) {
          touched = true;
          return { ...v, size: after };
        }
        return v;
      });
      if (touched) update.variants = nextVariants;
    }

    if (Object.keys(update).length > 0) {
      writes.push({ ref: doc.ref, update });
      changes.products.push({
        id: doc.id,
        title: data.title ?? '(untitled)',
        size: update.size ? `${before} → ${update.size}` : undefined,
        variants: update.variants
          ? data.variants.map((v, i) => (v?.size !== update.variants[i]?.size ? `${v?.size} → ${update.variants[i]?.size}` : null)).filter(Boolean)
          : undefined,
      });
    }
  });

  return { scanned, writes };
}

async function backfillCharts(db, changes) {
  const snap = await db.collection('size_charts').get();
  let scanned = 0;
  const writes = [];

  snap.forEach((doc) => {
    scanned += 1;
    const data = doc.data();
    if (!Array.isArray(data.sizes)) return;

    const normalized = data.sizes
      .map((s) => normalizeSize(s))
      .filter((s) => s && s.length > 0);
    const deduped = Array.from(new Set(normalized));
    const ordered = orderLikePreset(deduped, data.categoryType, data.sizeSystem);

    const same =
      ordered.length === data.sizes.length && ordered.every((s, i) => s === data.sizes[i]);
    if (same) return;

    writes.push({ ref: doc.ref, update: { sizes: ordered } });
    changes.charts.push({
      id: doc.id,
      chart: `${data.categoryType} · ${data.sizeSystem}`,
      before: data.sizes.join(', '),
      after: ordered.join(', '),
    });
  });

  return { scanned, writes };
}

async function commit(db, writes) {
  // Firestore caps a batch at 500 operations.
  let done = 0;
  for (let i = 0; i < writes.length; i += 450) {
    const slice = writes.slice(i, i + 450);
    const batch = db.batch();
    slice.forEach(({ ref, update }) => batch.update(ref, update));
    await batch.commit();
    done += slice.length;
    process.stdout.write(`  committed ${done}/${writes.length}\r`);
  }
  if (done > 0) process.stdout.write('\n');
}

async function main() {
  const db = initFirestore();
  const changes = { products: [], charts: [] };
  const pending = [];

  console.log(`\nMode: ${APPLY ? 'APPLY (writes to Firestore)' : 'DRY RUN (no writes)'}`);
  console.log(`Scope: ${ONLY}\n`);

  if (doCharts) {
    const { scanned, writes } = await backfillCharts(db, changes);
    console.log(`size_charts: scanned ${scanned}, ${writes.length} need changes`);
    changes.charts.forEach((c) => {
      console.log(`  · ${c.chart}`);
      console.log(`      before: ${c.before}`);
      console.log(`      after:  ${c.after}`);
    });
    pending.push(...writes);
  }

  if (doProducts) {
    const { scanned, writes } = await backfillProducts(db, changes);
    console.log(`\nproducts: scanned ${scanned}, ${writes.length} need changes`);
    changes.products.forEach((c) => {
      const parts = [c.size, ...(c.variants ?? [])].filter(Boolean).join('; ');
      console.log(`  · ${c.title} — ${parts}`);
    });
    pending.push(...writes);
  }

  if (BACKUP) {
    writeFileSync(BACKUP, JSON.stringify(changes, null, 2));
    console.log(`\nChange log written to ${BACKUP}`);
  }

  if (pending.length === 0) {
    console.log('\nNothing to change — already canonical.\n');
    return;
  }

  if (!APPLY) {
    console.log(`\n${pending.length} document(s) would change. Re-run with --apply to write.\n`);
    return;
  }

  console.log(`\nWriting ${pending.length} document(s)...`);
  await commit(db, pending);
  console.log('Done.\n');
}

main().catch((err) => {
  console.error('\nFailed:', err?.message ?? err);
  process.exit(1);
});
