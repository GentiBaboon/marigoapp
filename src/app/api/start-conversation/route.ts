import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase-admin';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFS(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFS) } };
  if (typeof v === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFS(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fromFS(v: any): any {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFS);
  if ('mapValue' in v) {
    const obj: Record<string, any> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = fromFS(val);
    return obj;
  }
  return null;
}

async function getUser(userId: string, idToken: string) {
  const res = await fetch(`${BASE}/users/${userId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return null;
  const doc = await res.json();
  if (!doc.fields) return null;
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields as Record<string, any>)) data[k] = fromFS(v);
  return data;
}

async function findExistingConversation(
  buyerId: string,
  sellerId: string,
  productId: string,
  idToken: string
): Promise<string | null> {
  // Query conversations where productId matches and buyer is a participant
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'conversations' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'productId' },
                op: 'EQUAL',
                value: { stringValue: productId },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'participants' },
                op: 'ARRAY_CONTAINS',
                value: { stringValue: buyerId },
              },
            },
          ],
        },
      },
      limit: { value: 10 },
    },
  };

  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const results = await res.json();

  for (const r of results as any[]) {
    if (!r.document) continue;
    const fields = r.document.fields || {};
    const participants = fromFS(fields.participants) as string[];
    if (participants.includes(sellerId)) {
      return r.document.name.split('/').pop();
    }
  }
  return null;
}

async function createConversation(
  buyerId: string,
  sellerId: string,
  productId: string,
  productTitle: string,
  productImage: string,
  buyerDetails: { name: string; avatar?: string },
  sellerDetails: { name: string; avatar?: string },
  idToken: string
): Promise<string> {
  const fields: Record<string, any> = {};
  const data = {
    participants: [buyerId, sellerId],
    participantDetails: [
      { userId: buyerId, name: buyerDetails.name, avatar: buyerDetails.avatar || '' },
      { userId: sellerId, name: sellerDetails.name, avatar: sellerDetails.avatar || '' },
    ],
    productId,
    productTitle,
    productImage,
    lastMessage: '',
    lastMessageAt: new Date().toISOString(),
    unreadCount: { [buyerId]: 0, [sellerId]: 0 },
    createdAt: new Date().toISOString(),
  };

  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFS(v);
  }

  const res = await fetch(`${BASE}/conversations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  const doc = await res.json();
  if (!res.ok) throw new Error(doc.error?.message || 'Failed to create conversation');
  return doc.name.split('/').pop();
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
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

    const buyerId = decoded.sub;
    const { productId, sellerId, productTitle, productImage } = await req.json();

    if (!productId || !sellerId) {
      return NextResponse.json({ error: 'productId and sellerId are required' }, { status: 400 });
    }

    if (buyerId === sellerId) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    // Check for existing conversation
    const existingId = await findExistingConversation(buyerId, sellerId, productId, idToken);
    if (existingId) {
      return NextResponse.json({ conversationId: existingId, isNew: false });
    }

    // Fetch user profiles for participant details
    const [buyerData, sellerData] = await Promise.all([
      getUser(buyerId, idToken),
      getUser(sellerId, idToken),
    ]);

    const conversationId = await createConversation(
      buyerId,
      sellerId,
      productId,
      productTitle || 'Item',
      productImage || '',
      { name: buyerData?.name || 'Buyer', avatar: buyerData?.profileImage },
      { name: sellerData?.name || 'Seller', avatar: sellerData?.profileImage },
      idToken
    );

    return NextResponse.json({ conversationId, isNew: true });
  } catch (err: any) {
    console.error('start-conversation error:', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
