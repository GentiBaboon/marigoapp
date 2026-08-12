// Maps each FirebaseOptions key to the env var it comes from, so a failure can
// name the variable the operator actually has to set rather than the SDK's
// internal option name.
const REQUIRED_VARS = {
  apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
} as const;

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

/**
 * Throws if any Firebase env var is missing.
 *
 * Without this, an unset variable reaches the SDK as `undefined` and only
 * surfaces as `auth/invalid-api-key` — once per prerendered page, with a
 * minified stack and no mention of which variable is actually missing.
 *
 * Deliberately a function rather than a module-scope check: this module is
 * imported during `next build` page-data collection, and throwing at import
 * time would fail the build before any route code runs.
 */
export function assertFirebaseConfig() {
  const missing = (Object.keys(REQUIRED_VARS) as Array<keyof typeof REQUIRED_VARS>)
    .filter((key) => !firebaseConfig[key])
    .map((key) => REQUIRED_VARS[key]);

  if (missing.length === 0) return;

  throw new Error(
    `[firebase] Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.\n` +
      'NEXT_PUBLIC_* values are inlined at build time, so they must be present in the ' +
      'build environment — setting them afterwards requires a fresh deploy, not a restart.\n' +
      'On Vercel: Settings → Environment Variables (Production + Preview), then redeploy. ' +
      'See docs/vercel-deploy.md.'
  );
}
