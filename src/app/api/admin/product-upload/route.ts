import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyIdToken, firestoreGet } from '@/lib/firebase-admin';

const BUCKET = 'MARIGO_BUCKED';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
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

    const userDoc = await firestoreGet('users', decoded.sub, idToken);
    if (!['admin', 'super_admin'].includes(userDoc?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sellerId = formData.get('sellerId') as string | null;
    const productId = formData.get('productId') as string | null;
    const index = formData.get('index') as string | null;

    if (!file || !sellerId || !productId || index === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const contentType = file.type.startsWith('image/') ? file.type : 'image/jpeg';
    const ext = contentType.split('/')[1]?.replace('+xml', '') || 'jpg';
    const fileName = `img_${Date.now()}_${index}.${ext}`;
    const storagePath = `${sellerId}/${productId}/${fileName}`;

    const supabase = getSupabaseAdmin();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, cacheControl: '31536000', upsert: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return NextResponse.json({ url: urlData.publicUrl, path: storagePath, position: Number(index) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
