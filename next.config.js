
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
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.googletagmanager.com https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net https://*.supabase.co wss://*.firebaseio.com https://api.stripe.com https://api.mailtrap.io https://*.google-analytics.com" + emulatorOrigins,
              "frame-src 'self' https://js.stripe.com https://*.firebaseapp.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
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
}

module.exports = isNative ? nextConfig : withPWA(nextConfig);
