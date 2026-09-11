
// One source tree, two build targets.
//
//   web    (default)  → SSR on Vercel. API routes, middleware, server metadata,
//                       next/image optimization, PWA service worker. Unchanged.
//   native            → `output: 'export'` static bundle for the Capacitor iOS
//                       and Android shells. No server exists inside the app, so
//                       API routes/middleware are not emitted and the app calls
//                       the deployed Vercel origin over the network instead.
//
// The native build writes to its own distDir. Sharing `.next` with the web build
// is what makes `npm run dev` start 404-ing every _next/static chunk, so the two
// targets are kept strictly apart on disk.
const isNative = process.env.NEXT_PUBLIC_BUILD_TARGET === 'native';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Capacitor ships its own bundled assets and offline story; a second service
  // worker inside the WebView only fights it for control of the cache.
  disable: process.env.NODE_ENV === 'development' || isNative,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Escape hatch for building while `npm run dev` is running. A production build
  // normally overwrites `.next`, after which the dev server 404s every
  // `_next/static/*` chunk and the page renders as unstyled HTML with nothing in
  // the terminal to explain it. `NEXT_DIST_DIR=.next-check npm run build`
  // verifies a build without touching the running server.
  ...(!isNative && process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  ...(isNative
    ? {
        output: 'export',
        distDir: '.next-native',
        // Capacitor serves from a local origin where directory-style URLs
        // resolve far more predictably than extensionless files.
        trailingSlash: true,
      }
    : {}),
  typescript: {
    // TODO: Set to false once all pre-existing TS errors are fixed.
    // Known issues: FirestoreTimestamp.toDate() type mismatch, displayName field.
    ignoreBuildErrors: true,
  },
  eslint: {
    // TODO: Set to false once lint errors are cleaned up.
    ignoreDuringBuilds: true,
  },
  images: {
    // A static export ships no image optimizer, so every next/image must fall
    // back to the raw source URL. remotePatterns stays declared for the web
    // build, which does optimize.
    unoptimized: isNative,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Any Supabase storage project, current or legacy. next/image THROWS on an
      // unlisted host, which crashes the whole page rather than just failing the
      // image — so listing projects individually meant that rotating
      // NEXT_PUBLIC_SUPABASE_URL took down every page still showing an image
      // from the previous project.
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  /**
   * Serve Firebase Auth's handler from our own origin.
   *
   * Google / Apple sign-in on iPhone goes through `signInWithRedirect`, which
   * bounces via the `authDomain`. With the default `<project>.firebaseapp.com`
   * that is a third-party origin, and Safari's storage partitioning (ITP,
   * 16.1+) stops the handler passing the result back — the user picks their
   * Google account and lands on the sign-in page again, or on a spinner that
   * never ends. That is what the first seller trying to open a sale from the
   * "Prepare the order" email hit on 2026-09-06.
   *
   * Firebase's documented fix: set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` to the
   * site's own host and reverse-proxy `/__/auth/*` to the project's
   * firebaseapp.com. Then everything is first-party. The rewrite is harmless
   * while the env still names firebaseapp.com — nothing requests these paths.
   * Switching the env also needs two console changes (docs/vercel-deploy.md §2b).
   */
  async rewrites() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) return [];
    return [
      {
        source: '/__/auth/:path*',
        destination: `https://${projectId}.firebaseapp.com/__/auth/:path*`,
      },
    ];
  },
  async headers() {
    // In dev, allow connections to the Firebase emulator suite + the
    // Stripe-CLI forwarder. Production keeps the strict CSP.
    const isDev = process.env.NODE_ENV !== 'production';
    const emulatorOrigins = isDev
      ? ' http://127.0.0.1:5001 http://localhost:5001 http://127.0.0.1:8080 http://localhost:8080 http://127.0.0.1:9099 http://localhost:9099 ws://127.0.0.1:9099 ws://localhost:9099'
      : '';
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
          },
          {
            // Isolates our window from cross-origin documents that open it,
            // while keeping a reference to the popups *we* open — which is
            // what Firebase's `signInWithPopup` needs to hand the credential
            // back. `same-origin` would sever that and break Google sign-in;
            // this is the value Firebase documents.
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              /**
               * `unsafe-eval` is a **dev-only** allowance. React Refresh and the
               * webpack HMR client compile modules with eval, so removing it
               * locally breaks fast refresh — but a production bundle never
               * calls eval, and leaving it on hands any injected script the
               * easiest possible execution primitive.
               *
               * `unsafe-inline` has to stay for now: the App Router emits inline
               * bootstrap and streaming-payload scripts, and dropping it needs
               * per-request nonces, which cannot be issued from `headers()` in
               * next.config.js — that is a middleware change and a separate
               * piece of work.
               */
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://apis.google.com https://www.googletagmanager.com https://js.stripe.com`,
              // Inline event handlers (onclick="…") are a classic XSS sink and
              // React never emits them, so this costs nothing and closes one.
              "script-src-attr 'none'",
              // Fonts are self-hosted by next/font (src/app/layout.tsx), so the
              // Google Fonts origins are gone from style-src and font-src.
              "style-src 'self' 'unsafe-inline'",
              /**
               * `http:` is gone — there is no legitimate plaintext image source
               * and it was a mixed-content hole. `https:` deliberately stays:
               * listings carry Supabase URLs that rotate with the project ref,
               * Google sign-in supplies avatars from googleusercontent.com, and
               * a too-narrow list here means silently broken images across the
               * catalogue rather than a visible error.
               */
              "img-src 'self' data: blob: https:",
              "media-src 'self' https: blob:",
              "font-src 'self'",
              // Mailtrap is gone — superseded by SendGrid, which is called
              // server-side and needs no browser origin at all.
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net https://*.supabase.co wss://*.firebaseio.com wss://*.firestore.googleapis.com https://api.stripe.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com" + emulatorOrigins,
              "frame-src 'self' https://js.stripe.com https://*.firebaseapp.com",
              // The PWA service worker and manifest, which default-src would
              // otherwise have to cover implicitly.
              "worker-src 'self' blob:",
              "manifest-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              // Belt to HSTS's braces: rewrites any stray http:// subresource
              // rather than blocking it outright.
              ...(isDev ? [] : ['upgrade-insecure-requests']),
            ].join('; '),
          },
        ],
      },
      // The proxied Firebase Auth handler (see `rewrites`). It is Google's
      // page, not ours: it loads its scripts from apis.google.com / gstatic
      // and runs inside a hidden iframe on our own pages, so the site-wide
      // `X-Frame-Options: DENY` and `frame-ancestors 'none'` above must not
      // reach it. In practice Next serves an external rewrite with the
      // upstream's headers (verified: neither rule lands on these paths), so
      // this is belt and braces for the day that changes. Later rules win
      // for the same header key.
      {
        source: '/__/auth/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' https: 'unsafe-inline' 'unsafe-eval'",
              "img-src 'self' https: data:",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

// Security headers are served by the host, so they mean nothing to a static
// export — Next warns about them rather than emitting anything. The Capacitor
// shells get their equivalent protection from the native config and the CSP
// meta tag in the app shell.
if (isNative) {
  delete nextConfig.headers;
  // `output: 'export'` cannot rewrite, and the WebView has no OAuth anyway.
  delete nextConfig.rewrites;
}

module.exports = isNative ? nextConfig : withPWA(nextConfig);
