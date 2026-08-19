/**
 * @fileOverview Where `/api/*` lives when there is no local server.
 *
 * On web the API routes are same-origin and every call site can keep using a
 * relative `fetch('/api/…')`. Inside the Capacitor shells the bundle is served
 * from `capacitor://localhost`, where that same relative path resolves to a file
 * in the app bundle and 404s — the API only exists on the Vercel deployment.
 *
 * Rather than rewrite the ~14 call sites and depend on nobody forgetting a
 * helper later, `installNativeFetch()` patches `window.fetch` once so relative
 * API paths are resolved against the deployment. Firebase, Supabase and Stripe
 * all use absolute URLs already and are untouched by it.
 */

import { SITE_URL } from '@/lib/site';
import { isNativeApp } from './native';

/**
 * Origin the native app talks to. Override per build to point a device at a
 * staging deployment, or at your machine's LAN address during development.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || SITE_URL).replace(/\/$/, '');

/** Absolute URL for an API path — relative on web, deployment-absolute natively. */
export function apiUrl(path: string): string {
  if (!path.startsWith('/')) return path;
  return isNativeApp() ? `${API_BASE_URL}${path}` : path;
}

let installed = false;

/**
 * Idempotently redirects relative `/api/*` fetches to {@link API_BASE_URL}.
 *
 * Only `/api/` prefixed paths are touched. Requests for bundled assets must
 * keep resolving locally, so a blanket rewrite of every relative URL would
 * break the app's own chunks and images.
 */
export function installNativeFetch(): void {
  if (installed) return;
  if (typeof window === 'undefined') return;
  if (!isNativeApp()) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return originalFetch(`${API_BASE_URL}${input}`, init);
    }
    // A Request carries the already-resolved capacitor:// URL in `.url`, so the
    // path has to be recovered from it before it can be re-pointed.
    if (input instanceof Request && input.url) {
      try {
        const { pathname, search } = new URL(input.url);
        if (pathname.startsWith('/api/')) {
          return originalFetch(new Request(`${API_BASE_URL}${pathname}${search}`, input), init);
        }
      } catch {
        // Not a parseable URL — fall through to the original fetch untouched.
      }
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof window.fetch;

  installed = true;
}
