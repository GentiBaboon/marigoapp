import * as jose from 'jose';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

// Firebase public keys endpoint
const FIREBASE_JWKS = jose.createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
);

/**
 * Verify a Firebase ID token using Google's public keys.
 * No service account key required — works on any serverless platform.
 */
export async function verifyIdToken(idToken: string) {
  const { payload } = await jose.jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  return payload as jose.JWTPayload & { uid?: string; sub: string };
}

// ─── Firestore REST API helpers ──────────────────────────────────────────────
// Uses the user's ID token (respects Firestore security rules) or a server
// token for privileged writes when the user token has sufficient access.

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/** Convert Firestore REST value format to a plain JS value */
function fromFirestore(value: any): any {
  if (value === undefined || value === null) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestore);
  if ('mapValue' in value) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      obj[k] = fromFirestore(v);
    }
    return obj;
  }
  return null;
}

/** Convert a plain JS value to Firestore REST value format */
function toFirestore(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestore) } };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestore(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

/** Parse a Firestore REST document into a plain JS object */
function parseDoc(doc: any): Record<string, any> | null {
  if (!doc || doc.error) return null;
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    result[k] = fromFirestore(v);
  }
  return result;
}

/** GET a single document. Uses user token for auth (respects security rules). */
export async function firestoreGet(
  collection: string,
  docId: string,
  idToken: string
): Promise<Record<string, any> | null> {
  const res = await fetch(`${BASE}/${collection}/${docId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return null;
  return parseDoc(await res.json());
}

/** Simple Firestore query using a single equality filter */
export async function firestoreQuery(
  collection: string,
  field: string,
  value: string,
  idToken: string,
  limit = 1
): Promise<Array<{ id: string; data: Record<string, any> }>> {
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: 'EQUAL',
          value: toFirestore(value),
        },
      },
      limit: { value: limit },
    },
  };

  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [];
  const results = await res.json();

  return (results as any[])
    .filter((r: any) => r.document)
    .map((r: any) => ({
      id: r.document.name.split('/').pop(),
      data: parseDoc(r.document)!,
    }));
}

/** UPDATE a document (PATCH with field mask) */
export async function firestoreUpdate(
  collection: string,
  docId: string,
  data: Record<string, any>,
  idToken: string
): Promise<void> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestore(v);
  }
  const updateMask = Object.keys(data)
    .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');

  await fetch(`${BASE}/${collection}/${docId}?${updateMask}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
}

/** CREATE a new document (POST, auto-generated ID) */
export async function firestoreCreate(
  collection: string,
  data: Record<string, any>,
  idToken: string
): Promise<string> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFirestore(v);
  }

  const res = await fetch(`${BASE}/${collection}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const doc = await res.json();
  if (!res.ok) throw new Error(doc.error?.message || 'Firestore write failed');

  // Return the auto-generated document ID
  return doc.name.split('/').pop();
}
