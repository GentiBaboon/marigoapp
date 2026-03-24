import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'product-images';

/**
 * Server-side upload endpoint.
 * Uses the service_role key to bypass RLS — the client sends the image as FormData.
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    const productId = formData.get('productId') as string | null;
    const index = formData.get('index') as string | null;

    if (!file || !userId || !productId || index === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Normalize content type — accept any image/* format
    const contentType = file.type.startsWith('image/') ? file.type : 'image/jpeg';
    const ext = contentType.split('/')[1]?.replace('+xml', '') || 'jpg';
    const fileName = `img_${Date.now()}_${index}.${ext}`;
    const storagePath = `${userId}/${productId}/${fileName}`;

    const supabase = getSupabaseAdmin();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        cacheControl: '31536000',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: storagePath,
      position: Number(index),
    });
  } catch (err: any) {
    console.error('Upload route error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
