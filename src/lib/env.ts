import { z } from 'zod';

/**
 * Environment variable validation.
 *
 * Client-side variables (NEXT_PUBLIC_*) are validated at import time.
 * Server-side variables are validated lazily via getServerEnv() to avoid
 * leaking them into the client bundle.
 */

// ── Client-side env (safe to expose — embedded in the JS bundle) ──
const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'Missing NEXT_PUBLIC_FIREBASE_API_KEY'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Missing NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, 'Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, 'Missing NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, 'Missing NEXT_PUBLIC_FIREBASE_APP_ID'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

// ── Server-side env (never exposed to the browser) ──
const serverEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1, 'Missing STRIPE_SECRET_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Missing SUPABASE_SERVICE_ROLE_KEY'),
  MAILTRAP_TOKEN: z.string().min(1, 'Missing MAILTRAP_TOKEN'),
  RESET_SERVICE_SECRET: z.string().min(1, 'Missing RESET_SERVICE_SECRET'),
  GOOGLE_GENAI_API_KEY: z.string().optional(),
});

// Validate client env at module load (only runs once due to module caching)
const clientResult = clientEnvSchema.safeParse({
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

if (!clientResult.success) {
  const missing = clientResult.error.issues.map((i) => i.message).join('\n  ');
  console.error(`\n[ENV ERROR] Missing required environment variables:\n  ${missing}\n\nCopy .env.example to .env.local and fill in the values.\n`);
}

export const clientEnv = clientResult.success ? clientResult.data : ({} as z.infer<typeof clientEnvSchema>);

/**
 * Get validated server-side environment variables.
 * Call this only in API routes or server components — never in client code.
 */
let _serverEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  if (_serverEnv) return _serverEnv;

  const result = serverEnvSchema.safeParse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    MAILTRAP_TOKEN: process.env.MAILTRAP_TOKEN,
    RESET_SERVICE_SECRET: process.env.RESET_SERVICE_SECRET,
    GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
  });

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.message).join(', ');
    throw new Error(`[ENV ERROR] Missing server env vars: ${missing}`);
  }

  _serverEnv = result.data;
  return _serverEnv;
}
