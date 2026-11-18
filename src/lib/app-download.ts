/**
 * The "get the app" link: `download.marigoapp.com` (and `/download` on the
 * main site) sends a phone to its own store and a desktop to a page with both.
 *
 * This used to live outside the codebase, in DNS / a Cloudflare rule, and
 * quietly stopped resolving when that record went away — so it is code now,
 * run from `src/middleware.ts`. Pure and Edge-safe: no I/O, no Node APIs.
 */

/** App Store Connect Apple ID 6826849847 (docs/store-release.md). */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6826849847';

/**
 * The same listing for a desktop browser. On a Mac the bare link is handed to
 * the Mac App Store app, which has no iPhone-only app and shows "An error
 * occurred" (reported 2026-11-18). A full storefront + slug URL with
 * `platform=iphone` is Apple's web page for the iPhone listing; the
 * `/download` page opens it in a new tab. Phones keep `APP_STORE_URL`, which
 * is meant to open the App Store app.
 */
export const APP_STORE_WEB_URL =
  'https://apps.apple.com/al/app/marigo-fashion-marketplace/id6826849847?platform=iphone';

/** The Play listing is `com.marigoapp.app`, not the `.marigo` bundle id (CLAUDE.md §14). */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.marigoapp.app';

/** Where a visitor the user agent cannot place lands: both store buttons. */
export const DOWNLOAD_PAGE_PATH = '/download';

export type StorePlatform = 'ios' | 'android';

/** True for `download.<anything>` — the production host and any preview alias. */
export function isDownloadHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return host.toLowerCase().split(':')[0].startsWith('download.');
}

/**
 * iPhone / iPod / iPad, or Android. In-app browsers (Instagram, Facebook,
 * TikTok) keep the OS token, so a link shared in a story still resolves.
 *
 * iPadOS 13+ Safari reports itself as a Mac, so an iPad usually returns null
 * and gets the page with both buttons — which still works for them.
 */
export function detectStorePlatform(userAgent: string | null | undefined): StorePlatform | null {
  if (!userAgent) return null;
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  return null;
}

export function storeUrlFor(platform: StorePlatform): string {
  return platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
}

/**
 * Where middleware should send this request, or null to leave it alone.
 *
 * - On the download host: every path goes somewhere — the store for a phone,
 *   the main site's `/download` page otherwise. The host serves nothing else,
 *   so a stray `download.marigoapp.com/foo` must not render the shop.
 * - On the main site: only `/download` redirects, and only a phone; a desktop
 *   is shown the page itself.
 */
export function downloadRedirectTarget(args: {
  host: string | null | undefined;
  pathname: string;
  userAgent: string | null | undefined;
  siteUrl: string;
}): string | null {
  const platform = detectStorePlatform(args.userAgent);
  const onDownloadHost = isDownloadHost(args.host);
  const onDownloadPath = args.pathname.replace(/\/+$/, '') === DOWNLOAD_PAGE_PATH;

  if (!onDownloadHost && !onDownloadPath) return null;
  if (platform) return storeUrlFor(platform);
  if (onDownloadHost) return `${args.siteUrl.replace(/\/+$/, '')}${DOWNLOAD_PAGE_PATH}`;
  return null;
}
