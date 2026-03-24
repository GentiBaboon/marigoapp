import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * The bucket name for product images.
 * Must be created in the Supabase dashboard as a PUBLIC bucket.
 */
export const PRODUCT_IMAGES_BUCKET = 'product-images';
