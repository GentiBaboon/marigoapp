/** @type {import('next-sitemap').IConfig} */
module.exports = {
  // www.marigo.app does not resolve; the live site is www.marigoapp.com.
  // Keep this in step with SITE_URL in src/lib/site.ts.
  siteUrl: process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.marigoapp.com',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      { userAgent: '*', disallow: '/admin' },
      { userAgent: '*', disallow: '/profile' },
      { userAgent: '*', disallow: '/cart' },
      { userAgent: '*', disallow: '/checkout' },
      { userAgent: '*', disallow: '/messages' },
      { userAgent: '*', disallow: '/sell' },
      { userAgent: '*', disallow: '/auth' },
      { userAgent: '*', disallow: '/courier' },
      { userAgent: '*', disallow: '/delivery-partner' },
    ],
  },
  // Exclude all paths that are behind authentication or admin-only
  exclude: [
      // App Router icon conventions (src/app/icon.png, apple-icon.png) are
      // emitted as routes, so next-sitemap picks them up as if they were
      // pages. They are assets — keep them out of the sitemap.
      '/icon.png', '/apple-icon.png',
      '/admin', '/admin/*',
      '/profile', '/profile/*', 
      '/cart', 
      '/checkout', '/checkout/*',
      '/messages', '/messages/*', 
      '/sell', 
      '/auth', '/auth/*',
      '/courier', '/courier/*',
      '/delivery-partner/apply',
      '/auth/forgot-password',
      '/auth/login',
      '/auth/signup',
      '/auth/verify-email',
      '/checkout/success',
    ],
};