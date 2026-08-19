import { NextRequest, NextResponse } from 'next/server';

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

export function middleware(request: NextRequest) {
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

    // Exempt the native shells. CSRF defends against a browser silently
    // attaching this site's cookies to a request forged by another origin; the
    // iOS/Android WebViews are a separate origin that sends no cookies at all
    // (Allow-Credentials is off above), so there is no ambient authority to
    // forge. They also cannot read a __csrf cookie to echo one back.
    if (!hasBearer && !isAIRoute && !isNativeOrigin) {
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
