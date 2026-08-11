/**
 * Canonical origin for the site, used by metadata, JSON-LD and the sitemap.
 *
 * This was previously hardcoded as https://www.marigo.app in several files —
 * a domain that does not resolve. Every canonical URL, Open Graph URL and
 * sitemap entry pointed at a dead host. Keep it in one place so it cannot
 * drift again, and allow an env override per deployment.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  'https://www.marigoapp.com'
).replace(/\/$/, '');

export const SITE_NAME = 'MarigoApp';

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
