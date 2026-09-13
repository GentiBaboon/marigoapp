import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase-admin';
import { checkAccountAccess } from '@/lib/verified-account';
import { conversationLimiter, applyRateLimit } from '@/lib/rate-limit';

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
  callerId: string,
  counterpartyId: string,
  productId: string,
  idToken: string
): Promise<string | null> {
  // Conversations on this product that the caller is in — then check the
  // other party is too. Works from either side, so both land on one thread.
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
                value: { stringValue: callerId },
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
    // Skip dispute mirror threads — those are created by admin replies on a
    // refund/dispute case and happen to share productId + participants with a
    // regular buyer↔seller inquiry. "Contact Seller" must always land on a
    // normal product conversation, never on the dispute thread.
    const source = fromFS(fields.source);
    if (source === 'dispute' || fields.disputeId) continue;
    const participants = fromFS(fields.participants) as string[];
    if (participants.includes(counterpartyId)) {
      return r.document.name.split('/').pop();
    }
  }
  return null;
}

async function createConversation(
  callerId: string,
  counterpartyId: string,
  productId: string,
  productTitle: string,
  productImage: string,
  buyerDetails: { name: string; avatar?: string },
  sellerDetails: { name: string; avatar?: string },
  idToken: string
): Promise<string> {
  const fields: Record<string, any> = {};
  const data = {
    participants: [callerId, counterpartyId],
    participantDetails: [
      { userId: callerId, name: buyerDetails.name, avatar: buyerDetails.avatar || '' },
      { userId: counterpartyId, name: sellerDetails.name, avatar: sellerDetails.avatar || '' },
    ],
    productId,
    productTitle,
    productImage,
    lastMessage: '',
    lastMessageAt: new Date().toISOString(),
    unreadCount: { [callerId]: 0, [counterpartyId]: 0 },
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
  // Rate limit: 20 requests per minute per IP
  const rateLimitResponse = applyRateLimit(req, conversationLimiter);
  if (rateLimitResponse) return rateLimitResponse;

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

    // Only an account in good standing with a confirmed address may message a seller. Checked here, not in the
    // browser, because account creation is a client-side Firebase call this
    // server never sees — an unactivated (or throwaway-inbox) account is real
    // and signed in, and this is where it stops. See src/lib/verified-account.ts.
    const verified = await checkAccountAccess(decoded, idToken);
    if (!verified.ok) {
      return NextResponse.json(verified.body, { status: verified.status });
    }

    const callerId = decoded.sub;
    const { productId, sellerId, otherUserId, productTitle, productImage } = await req.json();

    // Either party may open the thread. The route was written for the product
    // page, where the caller is always the buyer and the counterparty is the
    // listing's seller — so a *seller* pressing "Contact buyer" would have
    // opened a conversation with themselves. `otherUserId` names the
    // counterparty outright; `sellerId` stays accepted for the buyer flow.
    const counterpartyId = typeof otherUserId === 'string' && otherUserId ? otherUserId : sellerId;

    if (!productId || !counterpartyId) {
      return NextResponse.json({ error: 'productId and a counterparty are required' }, { status: 400 });
    }

    if (callerId === counterpartyId) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    // Symmetric: the lookup is "a thread on this product that both of us are
    // in", so whoever presses the button first lands both of them in the same
    // one rather than opening a second thread from the other side.
    const existingId = await findExistingConversation(callerId, counterpartyId, productId, idToken);
    if (existingId) {
      return NextResponse.json({ conversationId: existingId, isNew: false });
    }

    const [callerData, counterpartyData] = await Promise.all([
      getUser(callerId, idToken),
      getUser(counterpartyId, idToken),
    ]);

    const conversationId = await createConversation(
      callerId,
      counterpartyId,
      productId,
      productTitle || 'Item',
      productImage || '',
      { name: callerData?.name || 'Member', avatar: callerData?.profileImage },
      { name: counterpartyData?.name || 'Member', avatar: counterpartyData?.profileImage },
      idToken
    );

    return NextResponse.json({ conversationId, isNew: true });
  } catch (err: any) {
    console.error('start-conversation error:', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
