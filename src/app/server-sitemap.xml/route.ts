import { fetchProductsForSitemap } from '@/lib/product-seo';
import { absoluteUrl } from '@/lib/site';

/**
 * Sitemap for listings, which live in Firestore and so cannot be enumerated by
 * next-sitemap at build time. Referenced from robots.txt via
 * `additionalSitemaps` in next-sitemap.config.js.
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
      const loc = escapeXml(absoluteUrl(`/products/${p.id}`));
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
