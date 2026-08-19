/** @type {import('next-sitemap').IConfig} */

// Routes that must not be crawled at all: private, transactional, or
// personalised. Kept in one list so robots.txt and the sitemap cannot
// contradict each other — a URL listed in the sitemap *and* disallowed here is
// exactly what Search Console reports as "Blocked by robots.txt".
const PRIVATE_PATHS = [
  '/admin',
  '/profile',
  '/cart',
  '/checkout',
  '/messages',
  '/sell',
  '/auth',
  '/courier',
  '/favorites',
  '/notifications',
  '/delivery-partner/apply',
];

// Indexable, but not their own landing page — they duplicate a canonical URL
// or are app-shell stand-ins. These carry `noindex` in their metadata and are
// deliberately left crawlable so Google can actually see that tag.
const NOINDEX_PATHS = [
  '/home',            // duplicate of `/`
  '/welcome',
  '/products/view',
  '/browse/view',
  '/messages/view',
  '/checkout/success/view',
  '/courier/delivery/view',
  '/profile/orders/view',
  '/profile/listings/sales/view',
  '/admin/products/view',
  '/admin/orders/view',
];

module.exports = {
  // www.marigo.app does not resolve; the live site is www.marigoapp.com.
  // Keep this in step with SITE_URL in src/lib/site.ts.
  siteUrl: process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.marigoapp.com',
  generateRobotsTxt: true,
  generateIndexSitemap: true,
  changefreq: 'daily',
  robotsTxtOptions: {
    // One group per user-agent rather than a repeated `User-agent: *` block per
    // rule, which is what next-sitemap emits from a policy-per-line config.
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      // Answer engines are explicitly welcomed: being cited in an AI answer is
      // now a real acquisition channel, and these crawlers are separate from
      // Googlebot, so a blanket rule alone leaves their behaviour ambiguous.
      { userAgent: 'GPTBot', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: 'ClaudeBot', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: 'Claude-User', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: 'PerplexityBot', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: 'Google-Extended', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: 'Applebot-Extended', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: 'CCBot', allow: '/', disallow: PRIVATE_PATHS },
    ],
    // No additionalSitemaps: `/sitemap.xml` is the single entry point. Listings
    // are added to that index by scripts/generate-sitemap.mjs, which runs in
    // `postbuild` right after this. Submitting the products sitemap separately
    // as well would report the same URLs under two sitemaps in Search Console.
  },
  exclude: [
    // App Router icon conventions (src/app/icon.png, apple-icon.png) are
    // emitted as routes, so next-sitemap picks them up as if they were
    // pages. They are assets — keep them out of the sitemap.
    '/icon.png',
    '/apple-icon.png',
    // Never in the sitemap: private, or a duplicate of a canonical URL.
    ...PRIVATE_PATHS.flatMap((p) => [p, `${p}/*`]),
    ...NOINDEX_PATHS,
    // Sitemaps are not pages.
    '/server-sitemap.xml',
    '/sitemap-products.xml',
    // Listings are submitted by sitemap-products.xml, so nothing under /products
    // belongs in the static sitemap. Without this, next-sitemap collapses the
    // dynamic segments of `/products/[id]/edit` and `/products/[id]/offers/
    // [offerId]` into the literal URLs `/products/edit` and `/products/offer`,
    // which resolve as listings with those ids — i.e. soft 404s.
    '/products',
    '/products/*',
  ],
};
