/**
 * Writes the listings sitemap as a real file, and folds it into the sitemap
 * index that next-sitemap produces.
 *
 * next-sitemap can only enumerate routes that exist at build time, and every
 * listing resolves out of Firestore — so on its own it emits a sitemap of
 * static pages and not one product. This runs straight after it in `postbuild`
 * and adds:
 *
 *   public/sitemap-products.xml   every active listing, with its image
 *   public/sitemap.xml            index, now pointing at pages *and* products
 *
 * Static files rather than a request-time handler: they are served from the
 * CDN, cost nothing to crawl, and cannot fail because Firestore was slow when
 * Googlebot called. The trade-off is that a listing enters the sitemap on the
 * next deploy rather than within the hour.
 *
 * The listing query is imported from src/lib/product-seo.ts through jiti, so
 * this script and the app cannot disagree about which products are indexable.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));

// next-sitemap runs before this and does not load .env.local, so neither does
// Next during `postbuild`. Read it ourselves when the vars are not already set.
function loadEnv() {
  const file = join(ROOT, '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    if (process.env[key]) continue;
    process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const SITE_URL = (
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.marigoapp.com'
).replace(/\/$/, '');

// `alias` mirrors the `@/*` path in tsconfig.json. Without it jiti resolves
// imports as plain Node would and any `@/…` inside a loaded TS module throws
// MODULE_NOT_FOUND — which only shows up here, never in `tsc` or `next build`,
// because those go through the bundler's resolver instead.
const jiti = require('jiti')(ROOT, { alias: { '@': join(ROOT, 'src') } });
const { fetchProductsForSitemap } = jiti('./src/lib/product-seo.ts');
const { buildProductPath } = jiti('./src/lib/product-slug.ts');

const esc = (v) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function productUrl(p) {
  const parts = [
    `    <loc>${esc(`${SITE_URL}${buildProductPath(p)}`)}</loc>`,
    p.updatedAt ? `    <lastmod>${esc(p.updatedAt)}</lastmod>` : null,
    '    <changefreq>daily</changefreq>',
    '    <priority>0.8</priority>',
    // Image extension: a fashion listing is discovered through Google Images
    // as often as through web results.
    p.image
      ? `    <image:image>\n      <image:loc>${esc(p.image)}</image:loc>${
          p.title ? `\n      <image:title>${esc(p.title)}</image:title>` : ''
        }\n    </image:image>`
      : null,
  ].filter(Boolean);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

async function main() {
  const products = await fetchProductsForSitemap();

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    products.map(productUrl).join('\n') +
    (products.length ? '\n' : '') +
    '</urlset>\n';

  writeFileSync(join(ROOT, 'public/sitemap-products.xml'), xml);
  console.log(`[sitemap] public/sitemap-products.xml — ${products.length} listings`);

  // Fold the new file into next-sitemap's index so one submitted URL covers
  // the whole site.
  const indexPath = join(ROOT, 'public/sitemap.xml');
  if (!existsSync(indexPath)) {
    console.warn('[sitemap] public/sitemap.xml not found — did next-sitemap run?');
    return;
  }
  let index = readFileSync(indexPath, 'utf8');
  const entry = `<sitemap><loc>${SITE_URL}/sitemap-products.xml</loc></sitemap>`;
  if (!index.includes('/sitemap-products.xml')) {
    index = index.replace('</sitemapindex>', `${entry}\n</sitemapindex>`);
    writeFileSync(indexPath, index);
  }
  console.log('[sitemap] public/sitemap.xml — index references pages + listings');
}

main().catch((err) => {
  // A build must not fail because Firestore was unreachable; the previous
  // sitemap stays in place and the next deploy refreshes it.
  console.error('[sitemap] generation failed:', err?.message ?? err);
  process.exit(0);
});
