'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Handshake, Hourglass, Percent, RefreshCw } from 'lucide-react';
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  type Firestore,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import type { FirestoreOffer, FirestoreProduct, FirestoreUser } from '@/lib/types';
import { effectiveStatus, summarizeOffers } from '@/lib/offers';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatCard } from '@/components/admin/stat-card';
import { DataTable } from '@/components/admin/offers/data-table';
import { columns, type AdminOfferRow } from '@/components/admin/offers/columns';
import OffersLoading from './loading';

/** Newest offers across every listing. Enough for an operator's view; the
 *  per-listing card on `/admin/products/[id]` is exhaustive for one item. */
const OFFERS_LIMIT = 200;

/**
 * Every offer on the platform, newest first.
 *
 * A collection-group `orderBy` needs a COLLECTION_GROUP-scoped single-field
 * index (`fieldOverrides` in `firestore.indexes.json`), which ships with
 * `firebase deploy --only firestore:indexes` — not with a git push. Until it
 * lands, Firestore rejects the ordered query, so fall back to the bare
 * collection-group read (which needs no index) and sort in memory. The cost
 * of the fallback is that `limit()` then picks an arbitrary 200 rather than
 * the latest 200, which the page says out loud.
 */
async function loadOfferDocs(firestore: Firestore): Promise<{
  docs: QueryDocumentSnapshot<DocumentData>[];
  indexMissing: boolean;
}> {
  try {
    const snap = await getDocs(
      query(collectionGroup(firestore, 'offers'), orderBy('createdAt', 'desc'), limit(OFFERS_LIMIT)),
    );
    return { docs: snap.docs, indexMissing: false };
  } catch (err: any) {
    const message = String(err?.message ?? '');
    if (err?.code === 'failed-precondition' || message.includes('index')) {
      const snap = await getDocs(query(collectionGroup(firestore, 'offers'), limit(OFFERS_LIMIT)));
      return { docs: snap.docs, indexMissing: true };
    }
    throw err;
  }
}

async function fetchMap<T>(
  ids: Iterable<string>,
  load: (id: string) => Promise<T | null>,
): Promise<Map<string, T>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  const entries = await Promise.all(
    unique.map(async (id) => [id, await load(id).catch(() => null)] as const),
  );
  const map = new Map<string, T>();
  for (const [id, value] of entries) if (value) map.set(id, value);
  return map;
}

function firstImageUrl(product: FirestoreProduct | undefined): string | null {
  const first = product?.images?.[0] as unknown;
  if (!first) return null;
  if (typeof first === 'string') return first;
  const img = first as { thumbnailUrl?: string; url?: string };
  return img.thumbnailUrl || img.url || null;
}

export default function AdminOffersPage() {
  const firestore = useFirestore();
  const [rows, setRows] = React.useState<AdminOfferRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [indexMissing, setIndexMissing] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError(null);
      try {
        const { docs, indexMissing } = await loadOfferDocs(firestore);

        const offers = docs.map((d) => {
          const data = { id: d.id, ...d.data() } as FirestoreOffer;
          // Older offers pre-date the denormalised `productId`; the parent
          // path still knows which listing they belong to.
          const productId = data.productId || d.ref.parent.parent?.id || '';
          return { ...data, productId };
        });

        // One read per distinct listing and person, not per row: a buyer who
        // bid on ten items is looked up once.
        const products = await fetchMap(
          offers.map((o) => o.productId),
          async (id) => {
            const snap = await getDoc(doc(firestore, 'products', id));
            return snap.exists() ? ({ id: snap.id, ...snap.data() } as FirestoreProduct) : null;
          },
        );
        const userIds = offers.flatMap((o) => [o.buyerId, o.sellerId || products.get(o.productId)?.sellerId || '']);
        const users = await fetchMap(userIds, async (id) => {
          const snap = await getDoc(doc(firestore, 'users', id));
          return snap.exists() ? ({ id: snap.id, ...snap.data() } as FirestoreUser) : null;
        });

        if (cancelled) return;

        const now = new Date();
        setRows(
          offers.map((offer) => {
            const product = products.get(offer.productId);
            const sellerId = offer.sellerId || product?.sellerId || '';
            const seller = users.get(sellerId);
            const buyer = users.get(offer.buyerId);
            return {
              ...offer,
              productTitle: product?.title || 'Listing no longer exists',
              productImage: firstImageUrl(product),
              listingPrice: typeof product?.price === 'number' ? product.price : null,
              sellerId,
              sellerName: seller?.name || (sellerId ? `${sellerId.slice(0, 8)}…` : 'Unknown seller'),
              sellerEmail: seller?.email || null,
              buyerName: offer.buyerName || buyer?.name || undefined,
              buyerEmail: buyer?.email || null,
              effectiveStatus: effectiveStatus(offer, now),
            };
          }),
        );
        setIndexMissing(indexMissing);
      } catch (err: any) {
        console.error('[admin/offers] load failed', err);
        if (cancelled) return;
        setError(
          err?.code === 'permission-denied'
            ? 'Offers need the collection-group Firestore rule deployed: firebase deploy --only firestore:rules'
            : err?.message || 'Could not load offers.',
        );
        setRows([]);
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [firestore, refreshKey]);

  const summary = React.useMemo(() => summarizeOffers(rows ?? []), [rows]);

  if (rows === null) return <OffersLoading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Offers</h1>
          <p className="text-muted-foreground">
            Every offer buyers have made to sellers, across all listings. Read-only — the negotiation belongs to the two parties.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsRefreshing(true);
            setRefreshKey((k) => k + 1);
          }}
          disabled={isRefreshing}
        >
          <RefreshCw className={isRefreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load offers</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {indexMissing && (
        <Alert>
          <AlertTitle>Showing an unordered sample</AlertTitle>
          <AlertDescription>
            The collection-group index for ordering offers by date is not deployed yet, so this list is an arbitrary
            {' '}{OFFERS_LIMIT} offers rather than the newest. Run{' '}
            <code className="font-mono text-xs">firebase deploy --only firestore:indexes</code> to fix it.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Offers"
          value={summary.total}
          icon={<Handshake className="h-4 w-4 text-muted-foreground" />}
          description={summary.total >= OFFERS_LIMIT ? `Newest ${OFFERS_LIMIT} shown` : 'All time'}
        />
        <StatCard
          title="Awaiting seller"
          value={summary.awaitingSeller}
          icon={<Hourglass className="h-4 w-4 text-muted-foreground" />}
          description="Open, no reply yet"
        />
        <StatCard
          title="Awaiting buyer"
          value={summary.awaitingBuyer}
          icon={<Hourglass className="h-4 w-4 text-muted-foreground" />}
          description="Seller has countered"
        />
        <StatCard
          title="Acceptance rate"
          value={summary.acceptanceRate == null ? '—' : `${Math.round(summary.acceptanceRate * 100)}%`}
          icon={<Percent className="h-4 w-4 text-muted-foreground" />}
          description={`${summary.accepted} accepted of the settled offers`}
        />
      </div>

      <DataTable columns={columns} data={rows} />

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Amounts are EUR, the storage currency. Expired offers are worked out on read; nothing here writes to Firestore.
      </p>
    </div>
  );
}
