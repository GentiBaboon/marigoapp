import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_GATE_COOKIE,
  ADMIN_GATE_TTL_DAYS,
  isGateEnabled,
  isUnlockPath,
  signGateCookie,
  verifyGateCookie,
} from '@/lib/admin-gate';

/**
 * Next.js Edge Middleware
 *
 * Runs on every matched request BEFORE the page/API handler.
 * - Checks for a Firebase session cookie (__session) on protected routes.
 * - Generates and validates CSRF tokens for API mutation endpoints.
 * - Adds security headers (belt-and-suspenders with next.config.js).
 *
 * NOTE: Full JWT verification is not available at the Edge because the
 * Firebase JWKS endpoint requires a network call that adds ~200ms.
 * The cookie presence check here blocks casual unauthenticated access;
 * each API route still verifies the ID token server-side via `verifyIdToken`.
 */

// ── Route groups ────────────────────────────────────────────────────────────

/** Routes that require any authenticated user */
const PROTECTED_ROUTES = [
  '/profile',
  '/sell',
  '/cart',
  '/checkout',
  '/messages',
  '/notifications',
  '/favorites',
];

/** Routes that require an admin (further verified client-side + in Firestore rules) */
const ADMIN_ROUTES = ['/admin'];

/** Routes that require a courier role */
const COURIER_ROUTES = ['/courier'];

/** API routes that mutate data (need CSRF protection) */
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Origins the Capacitor WebViews run under. The iOS shell serves the bundle
 * from `capacitor://localhost`; Android uses `https://localhost`. Both call this
 * deployment cross-origin, so `/api/*` has to answer them with CORS headers or
 * the WebView blocks the response before any handler sees it.
 *
 * This is an exact-match allow-list, never a reflection of any Origin sent.
 */
const NATIVE_ORIGINS = new Set([
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
]);

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-csrf-token',
  'Access-Control-Max-Age': '86400',
};

/** Adds the CORS headers for a recognised native origin. No-op otherwise. */
function applyCors(response: NextResponse, origin: string | null): NextResponse {
  if (!origin || !NATIVE_ORIGINS.has(origin)) return response;
  response.headers.set('Access-Control-Allow-Origin', origin);
  // Credentials stay off: the app authenticates with a Bearer ID token, never a
  // cookie, and allowing both would reintroduce the CSRF surface below.
  response.headers.set('Vary', 'Origin');
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

// ── CSRF helpers ────────────────────────────────────────────────────────────

const CSRF_COOKIE_NAME = '__csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a random CSRF token (Edge-compatible, no Node crypto needed).
 */
function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const isNativeOrigin = Boolean(origin && NATIVE_ORIGINS.has(origin));

  // ── 0. CORS preflight from the iOS / Android shells ──
  // Answered before anything else: a preflight carries no credentials and must
  // never be redirected by the auth gate below.
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return applyCors(new NextResponse(null, { status: 204 }), origin);
  }

  const response = NextResponse.next();

  // ── 1. Auth gate for protected page routes ──
  // We check for the Firebase __session cookie (set by the Firebase JS SDK
  // when persistence is enabled) OR a custom marigo_auth cookie.
  // This is a lightweight gate — full token verification happens server-side.
  const hasSession =
    request.cookies.has('__session') ||
    request.cookies.has('marigo_auth');

  const isProtectedPage = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAdminPage = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const isCourierPage = COURIER_ROUTES.some((r) => pathname.startsWith(r));

  // ── 1a. The masked door in front of /admin ──
  // Runs before the auth redirect below on purpose: redirecting to
  // /auth/login?redirect=/admin would announce the panel just as loudly as a
  // 403 would. See src/lib/admin-gate.ts.
  const gate = { unlockPath: process.env.ADMIN_UNLOCK_PATH, secret: process.env.ADMIN_GATE_SECRET };
  if (isGateEnabled(gate)) {
    // The secret path itself: mint the cookie and send them to the real panel.
    // A redirect rather than a rewrite, so the secret does not linger in the
    // address bar, in browser history, or in the Referer of the next request.
    if (isUnlockPath(pathname, gate.unlockPath!)) {
      const expiresAt = Date.now() + ADMIN_GATE_TTL_DAYS * 24 * 60 * 60 * 1000;
      const unlocked = NextResponse.redirect(new URL('/admin', request.url));
      unlocked.cookies.set(ADMIN_GATE_COOKIE, await signGateCookie(gate.secret!, expiresAt), {
        httpOnly: true, // never readable by JS — nothing in the app needs it
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // survives arriving from a bookmark or another site
        path: '/',
        maxAge: ADMIN_GATE_TTL_DAYS * 24 * 60 * 60,
      });
      return unlocked;
    }

    if (isAdminPage) {
      const unlockedAlready = await verifyGateCookie(
        gate.secret!,
        request.cookies.get(ADMIN_GATE_COOKIE)?.value,
      );
      if (!unlockedAlready) {
        /**
         * Rewritten so nothing matches, which makes Next answer 404.
         *
         * Two details, both learned by diffing the result against a real miss:
         *
         * 1. **No fixed sentinel.** Next embeds the rewritten pathname in the
         *    streamed router payload, so a constant like `/__mg_absent` lands
         *    in the HTML — and comparing the body with any other 404 then
         *    shows `/admin` was handled specially, which is the one fact the
         *    gate exists to hide. Only the original path is echoed here.
         *
         * 2. **Segment count is preserved.** A one-segment miss falls through
         *    to the root `/[gender]` route, which calls `notFound()`; a
         *    three-segment miss matches no route at all and gets Next's
         *    built-in 404. Those render *different* HTML shells, so adding or
         *    dropping a segment is itself a loud tell. Suffixing the first
         *    segment keeps the request in the same comparison class.
         *
         * What remains is the suffix character in the echoed path. Removing
         * even that would mean rendering the 404 body by hand and keeping it
         * in step with Next's own across upgrades — a brittle trade for an
         * attacker who, on a marketplace, would assume an admin panel anyway.
         */
        const [, first, ...rest] = pathname.split('/');
        const missing = request.nextUrl.clone();
        missing.pathname = `/${first}-${rest.length ? `/${rest.join('/')}` : ''}`;
        return NextResponse.rewrite(missing, { status: 404 });
      }
    }
  }

  // Admin pages are never indexable. robots.txt already disallows /admin, but
  // a disallowed URL can still be indexed from an inbound link — only a header
  // or meta tag on a page the crawler is allowed to fetch actually removes it
  // (the same reasoning as the /view routes in next-sitemap.config.js).
  if (isAdminPage) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  if ((isProtectedPage || isAdminPage || isCourierPage) && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 2. CSRF protection for API mutation routes ──
  if (pathname.startsWith('/api/') && CSRF_PROTECTED_METHODS.includes(request.method)) {
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const csrfHeader = request.headers.get(CSRF_HEADER_NAME);

    // Exempt: requests with a valid Bearer token already prove authenticity
    // because the token is not sent by browsers automatically (unlike cookies).
    // This covers our main API routes (create-order, upload, start-conversation).
    const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ');

    // Exempt AI routes — they are stateless read-only queries, not user data mutations.
    const isAIRoute = pathname.startsWith('/api/chat') || pathname.startsWith('/api/ai/');

    // Exempt one-click unsubscribe. RFC 8058 has Gmail and Yahoo POST to the
    // List-Unsubscribe URL directly from their own infrastructure, which has no
    // way to obtain a __csrf cookie — a CSRF check there simply breaks the
    // control those providers now require. Safe to exempt: the endpoint takes
    // no ambient authority at all, only a signed token that names the one
    // address it may act on.
    const isUnsubscribe = pathname.startsWith('/api/unsubscribe');

    // Exempt the native shells. CSRF defends against a browser silently
    // attaching this site's cookies to a request forged by another origin; the
    // iOS/Android WebViews are a separate origin that sends no cookies at all
    // (Allow-Credentials is off above), so there is no ambient authority to
    // forge. They also cannot read a __csrf cookie to echo one back.
    if (!hasBearer && !isAIRoute && !isUnsubscribe && !isNativeOrigin) {
      // For cookie-authenticated or unauthenticated POST requests (e.g. forgot-password),
      // require the CSRF token to match.
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return applyCors(
          NextResponse.json({ error: 'Invalid or missing CSRF token.' }, { status: 403 }),
          origin
        );
      }
    }
  }

  // ── 3. Set CSRF cookie if not present (for all page responses) ──
  if (!pathname.startsWith('/api/') && !request.cookies.has(CSRF_COOKIE_NAME)) {
    const token = generateCsrfToken();
    response.cookies.set(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // JS needs to read it to send in headers
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });
  }

  return applyCors(response, origin);
}

// Only run middleware on page routes and API routes (skip static assets, _next, etc.)
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icons, manifest, sw, workbox (PWA assets)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.json|sw\\.js|workbox-).*)',
  ],
};
