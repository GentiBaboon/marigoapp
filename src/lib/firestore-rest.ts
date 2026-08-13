/**
 * @fileOverview Minimal Firestore REST client for server routes.
 *
 * The app deliberately ships no service-account credentials (see
 * `src/lib/firebase-admin.ts`), so server-side reads of public collections go
 * over the REST API with the public web API key. Security rules still apply.
 *
 * Extracted from `chat-retrieval.ts` once the AI listing flow needed the same
 * decode/query plumbing — one copy, so a fix to the value decoding reaches both.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export const FIRESTORE_REST_BASE =
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/** True when the env needed to talk to Firestore is present. */
export function hasFirestoreRestConfig(): boolean {
  return Boolean(PROJECT_ID && API_KEY);
}

/** Unwrap Firestore's typed-value envelope into a plain JS value. */
export function decodeFirestoreValue(value: any): any {
  if (value == null) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return null;
}

/** Turn a REST document into `{ id, ...fields }`. */
export function decodeFirestoreDoc(doc: any): Record<string, any> | null {
  if (!doc?.name) return null;
  const out: Record<string, any> = { id: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(doc.fields || {})) out[k] = decodeFirestoreValue(v);
  return out;
}

/** Run a structured query and return decoded documents. Throws on HTTP error. */
export async function runFirestoreQuery(body: unknown): Promise<Record<string, any>[]> {
  const res = await fetch(`${FIRESTORE_REST_BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // Callers cache in-process; don't let Next add a second layer.
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Firestore query failed: ${res.status}`);
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : [])
    .map((r: any) => decodeFirestoreDoc(r.document))
    .filter((d): d is Record<string, any> => d !== null);
}

/** Read an entire small collection (catalog/taxonomy shaped). */
export function readCollection(collectionId: string, limit = 400) {
  return runFirestoreQuery({
    structuredQuery: { from: [{ collectionId }], limit: { value: limit } },
  });
}
