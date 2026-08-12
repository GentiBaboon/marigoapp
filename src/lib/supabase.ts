import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The bucket name for product images.
 * Must be created in the Supabase dashboard as a PUBLIC bucket.
 */
export const PRODUCT_IMAGES_BUCKET = 'product-images';

let client: SupabaseClient | null = null;

/**
 * Supabase browser client, created on first use.
 *
 * Deliberately *not* a module-scope `createClient(...)`: `next build` imports
 * every route to collect page data, and this module is imported by the upload
 * routes purely for PRODUCT_IMAGES_BUCKET above. Constructing the client at
 * import time meant that a build machine without NEXT_PUBLIC_SUPABASE_URL —
 * CI, for one — failed with "supabaseUrl is required" before it ever ran a
 * line of route code. Building must not require credentials.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  client = createClient(url, anonKey);
  return client;
}
