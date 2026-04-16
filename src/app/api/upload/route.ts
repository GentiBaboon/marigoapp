import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyIdToken } from '@/lib/firebase-admin';
import { uploadLimiter, applyRateLimit } from '@/lib/rate-limit';

const BUCKET = 'MARIGO_BUCKED';

/**
 * Server-side upload endpoint.
 * Requires a valid Firebase ID token in the Authorization header.
 * Verifies the authenticated user matches the userId in the request.
 * Uses the service_role key to bypass RLS for the actual upload.
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  // Rate limit: 30 requests per minute per IP
  const rateLimitResponse = applyRateLimit(request, uploadLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // ── Authentication: verify Firebase ID token ──
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    const authenticatedUid = decoded.sub;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    const productId = formData.get('productId') as string | null;
    const index = formData.get('index') as string | null;

    if (!file || !userId || !productId || index === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Authorization: ensure the requester owns this upload path ──
    if (authenticatedUid !== userId) {
      return NextResponse.json({ error: 'Forbidden: userId mismatch' }, { status: 403 });
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
