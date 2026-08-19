import { fetchProductsForSitemap } from '@/lib/product-seo';
import { absoluteUrl } from '@/lib/site';
import { buildProductPath } from '@/lib/product-slug';

/**
 * Always-fresh listings sitemap, read straight from Firestore.
 *
 * NOT the submitted one. What Search Console receives is the static
 * `public/sitemap-products.xml`, written at build time by
 * scripts/generate-sitemap.mjs and referenced from the sitemap index — served
 * from the CDN, and immune to Firestore being slow when a crawler calls.
 *
 * This route is kept as the live alternative: it reflects listings published
 * since the last deploy, which the static file cannot. Submit it as an extra
 * sitemap only if deploys become infrequent enough for that gap to matter.
 *
 * No `export const dynamic` on purpose: that would break `output: 'export'`
 * for the Capacitor build. Freshness comes from the hourly `revalidate` on the
 * underlying fetch, which gives ISR on Vercel and a harmless build-time
 * snapshot inside the app bundle.
 */
export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const products = await fetchProductsForSitemap();

  const urls = products
    .map((p) => {
      const loc = escapeXml(absoluteUrl(buildProductPath(p)));
      const lastmod = p.updatedAt ? `\n    <lastmod>${escapeXml(p.updatedAt)}</lastmod>` : '';
      return `  <url>\n    <loc>${loc}</loc>${lastmod}\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
