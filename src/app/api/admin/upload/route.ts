import { NextRequest, NextResponse } from 'next/server';
import { adminUploadLimiter, applyRateLimit } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';
import { verifyIdToken, firestoreGet } from '@/lib/firebase-admin';
import { PRODUCT_IMAGES_BUCKET as BUCKET } from '@/lib/supabase';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  // Rate limit before any model call — see src/lib/rate-limit.ts for why these
  // routes are the cheapest way to take the whole AI surface down.
  const limited = applyRateLimit(request, adminUploadLimiter);
  if (limited) return limited;

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.slice(7);

    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check admin role using the Firestore REST API with the user's own token
    const userDoc = await firestoreGet('users', decoded.sub, idToken);
    const role = userDoc?.role;
    if (!['admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const contentType = file.type.startsWith('image/') ? file.type : 'image/jpeg';
    const ext = contentType.split('/')[1]?.replace('+xml', '') || 'jpg';
    const fileName = `settings/blocks/block_${Date.now()}.${ext}`;

    const supabase = getSupabaseAdmin();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, { contentType, cacheControl: '31536000', upsert: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
