
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
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

module.exports = withPWA(nextConfig);
