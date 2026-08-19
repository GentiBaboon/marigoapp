import { extractProductId } from '@/lib/product-slug';
/**
 * Server-side product lookup for SEO.
 *
 * The product page is a client component that loads its data from Firestore
 * after hydration, so nothing product-specific used to exist in the initial
 * HTML — no unique <title>, no description, no canonical, and the JSON-LD was
 * injected only after the client fetch resolved. Crawlers had to execute JS to
 * see any of it.
 *
 * /products and /reviews are both `allow read: if true`, so they can be read
 * over the REST API with just the public web API key — no service account and
 * no user token required.
 */

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Unwrap one Firestore REST typed value into plain JS. */
function decode(v: any): any {
  if (v == null) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {});
  return undefined;
}

function decodeFields(fields: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
}

export interface SeoProduct {
  id: string;
  title?: string;
  description?: string;
  brandId?: string;
  categoryId?: string;
  subcategoryId?: string;
  condition?: string;
  price?: number;
  currency?: string;
  status?: string;
  color?: string;
  material?: string;
  size?: string;
  images?: { url: string; position?: number }[];
  sellerId?: string;
  /** Admin SEO overrides, set on the listing's SEO panel. See product-slug.ts. */
  seoSlug?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface SeoReview {
  rating: number;
  content?: string;
  createdAt?: string;
}

/**
 * Look a listing up by its stored `seoSlug`.
 *
 * Equality filters need no composite index in Firestore, so this works without
 * any index configuration. Returns null when nothing matches, which is the
 * signal for callers to fall back to a document read.
 */
export async function fetchProductBySlug(slug: string): Promise<SeoProduct | null> {
  if (!PROJECT || !API_KEY || !slug) return null;
  try {
    const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'products' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'seoSlug' },
              op: 'EQUAL',
              value: { stringValue: slug },
            },
          },
          limit: 1,
        },
      }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const doc = (Array.isArray(rows) ? rows : []).find((r: any) => r?.document?.fields)?.document;
    if (!doc) return null;
    return { id: String(doc.name).split('/').pop() as string, ...decodeFields(doc.fields) } as SeoProduct;
  } catch {
    return null;
  }
}

/**
 * Resolve whatever is in the `[id]` segment to a listing.
 *
 * Order matters and mirrors how the URLs came to exist: the canonical slug
 * first, then the interim `slug--id` shape, then a bare document id. All three
 * are live in the wild.
 */
export async function resolveSeoProduct(param: string): Promise<SeoProduct | null> {
  if (!param) return null;
  const bySlug = await fetchProductBySlug(param);
  if (bySlug) return bySlug;
  const id = extractProductId(param);
  return fetchProductForSeo(id);
}

export async function fetchProductForSeo(id: string): Promise<SeoProduct | null> {
  if (!PROJECT || !API_KEY) return null;
  try {
    const res = await fetch(`${BASE}/products/${encodeURIComponent(id)}?key=${API_KEY}`, {
      // Product copy changes rarely; revalidate hourly so crawlers get fresh
      // data without hammering Firestore on every request.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.fields) return null;
    return { id, ...decodeFields(json.fields) } as SeoProduct;
  } catch {
    return null;
  }
}

/**
 * Reviews for a product. Returns [] when there are none — callers must then
 * omit aggregateRating/review from the JSON-LD entirely rather than emit
 * placeholder values, which would breach Google's structured data policy.
 */
export async function fetchProductReviews(productId: string): Promise<SeoReview[]> {
  if (!PROJECT || !API_KEY) return [];
  try {
    const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'reviews' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'productId' },
              op: 'EQUAL',
              value: { stringValue: productId },
            },
          },
          limit: 50,
        },
      }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return (Array.isArray(rows) ? rows : [])
      .filter((r: any) => r?.document?.fields)
      .map((r: any) => decodeFields(r.document.fields))
      .filter((r: any) => typeof r.rating === 'number')
      .map((r: any) => ({ rating: r.rating, content: r.content, createdAt: r.createdAt }));
  } catch {
    return [];
  }
}

export interface SitemapProduct {
  id: string;
  title?: string;
  brandId?: string;
  color?: string;
  size?: string;
  seoSlug?: string;
  updatedAt?: string;
  /** First usable image, emitted as a Google image-sitemap extension. */
  image?: string;
}

/**
 * Every listing that should appear in the sitemap.
 *
 * Product pages are the whole SEO surface of a marketplace, and none of them
 * were being submitted: next-sitemap can only enumerate routes it can see at
 * build time, and `/products/[id]` resolves out of Firestore. The generated
 * sitemap listed 12 static pages and not a single listing.
 *
 * Only `active` products are included. `sold`, `removed`, `draft` and
 * `pending_review` listings would be soft-404s or thin pages, and submitting
 * them is what turns one crawl budget problem into a quality signal problem.
 *
 * Paginated over the REST API with the public web key — `/products` is
 * `allow read: if true`, so this needs no service account.
 */
export async function fetchProductsForSitemap(limit = 5000): Promise<SitemapProduct[]> {
  if (!PROJECT || !API_KEY) return [];
  const out: SitemapProduct[] = [];
  let pageToken: string | undefined;

  try {
    // 300 docs per page keeps each response small; loop until Firestore stops
    // handing back a token or we hit the cap.
    while (out.length < limit) {
      const url = new URL(`${BASE}/products`);
      url.searchParams.set('pageSize', '300');
      url.searchParams.set('key', API_KEY);
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (!res.ok) break;
      const json = await res.json();

      for (const doc of json.documents ?? []) {
        const f = decodeFields(doc.fields ?? {});
        if (f.status !== 'active') continue;
        const images = Array.isArray(f.images) ? f.images : [];
        const image = images
          .slice()
          .sort((a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0))
          .find((i: any) => typeof i?.url === 'string' && i.url.startsWith('http'))?.url;
        out.push({
          id: String(doc.name).split('/').pop() as string,
          title: typeof f.title === 'string' ? f.title : undefined,
          brandId: f.brandId,
          color: f.color,
          size: f.size,
          seoSlug: f.seoSlug,
          updatedAt: f.updatedAt || f.listingCreated || undefined,
          image,
        });
      }

      pageToken = json.nextPageToken;
      if (!pageToken) break;
    }
  } catch {
    // A sitemap that 500s is worse than a short one — fall through with
    // whatever was collected.
  }

  return out.slice(0, limit);
}
