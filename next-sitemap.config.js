/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://www.marigo.app',
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