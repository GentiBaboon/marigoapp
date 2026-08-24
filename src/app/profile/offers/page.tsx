'use client';

import * as React from 'react';
import Link from 'next/link';
import { Handshake } from 'lucide-react';
import { collectionGroup, query, where, getDocs, getDoc, limit, orderBy } from 'firebase/firestore';

import { useUser, useFirestore } from '@/firebase';
import type { FirestoreOffer, FirestoreProduct } from '@/lib/types';
import { effectiveStatus, isOpen, awaitingParty, type OfferActor } from '@/lib/offers';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OfferListItem } from '@/components/profile/offer-list-item';

export type OfferWithProduct = FirestoreOffer & { product: FirestoreProduct; role: OfferActor };

function OffersSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton className="h-24 w-24 rounded-md" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-10">
      <Handshake className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="text-lg font-semibold mt-4">Nothing here yet</h3>
      <p className="text-muted-foreground mt-2">{message}</p>
    </div>
  );
}

export default function OffersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [offers, setOffers] = React.useState<OfferWithProduct[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user || !firestore) {
      if (!isUserLoading) setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchOffers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        /**
         * Two collection-group queries, one per side of the trade. Both are
         * needed: this screen used to run only the `buyerId` one, so a seller
         * had no list of offers on their own listings anywhere in the app —
         * just a count badge on the listing card, which linked nowhere.
         *
         * `sellerId` is denormalised onto the offer precisely so this query is
         * possible; a collection-group query cannot reach the parent product.
         */
        const [asBuyer, asSeller] = await Promise.all([
          getDocs(query(
            collectionGroup(firestore, 'offers'),
            where('buyerId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(50),
          )),
          getDocs(query(
            collectionGroup(firestore, 'offers'),
            where('sellerId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(50),
          )),
        ]);

        const rows = await Promise.all(
          [
            ...asBuyer.docs.map((d) => ({ doc: d, role: 'buyer' as OfferActor })),
            ...asSeller.docs.map((d) => ({ doc: d, role: 'seller' as OfferActor })),
          ].map(async ({ doc: offerDoc, role }) => {
            const offerData = { id: offerDoc.id, ...offerDoc.data() } as FirestoreOffer;
            const productRef = offerDoc.ref.parent.parent;
            if (!productRef) return null;
            const productSnap = await getDoc(productRef);
            if (!productSnap.exists()) return null;
            const product = { id: productSnap.id, ...productSnap.data() } as FirestoreProduct;
            return { ...offerData, product, role };
          }),
        );

        if (cancelled) return;
        setOffers(rows.filter((o): o is OfferWithProduct => o !== null));
      } catch (err: any) {
        console.error('Error fetching offers:', err);
        if (!cancelled) {
          // The two failures worth telling apart are both deployment gaps,
          // not user errors: a collection-group query needs its own
          // `{path=**}/offers` rule *and* a composite index. Reporting either
          // as "please try again" sends the reader looking for a network
          // problem that isn't there.
          const message = String(err?.message ?? '');
          setError(
            err?.code === 'permission-denied'
              ? 'Offers need the collection-group Firestore rule deployed: firebase deploy --only firestore:rules'
              : message.includes('index')
                ? 'Offers need a Firestore index deployed: firebase deploy --only firestore:indexes'
                : 'Could not load your offers. Please try again.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchOffers();
    return () => { cancelled = true; };
  }, [user, firestore, isUserLoading]);

  const { received, sent, actionCount } = React.useMemo(() => {
    // Whoever's turn it is sorts to the top — an offer waiting on you is the
    // only thing on this screen you can actually do something about.
    const byUrgency = (a: OfferWithProduct, b: OfferWithProduct) => {
      const aTurn = awaitingParty(effectiveStatus(a)) === a.role ? 0 : 1;
      const bTurn = awaitingParty(effectiveStatus(b)) === b.role ? 0 : 1;
      if (aTurn !== bTurn) return aTurn - bTurn;
      const aOpen = isOpen(effectiveStatus(a)) ? 0 : 1;
      const bOpen = isOpen(effectiveStatus(b)) ? 0 : 1;
      return aOpen - bOpen;
    };
    const r = offers.filter((o) => o.role === 'seller').sort(byUrgency);
    const s = offers.filter((o) => o.role === 'buyer').sort(byUrgency);
    return {
      received: r,
      sent: s,
      actionCount: offers.filter((o) => awaitingParty(effectiveStatus(o)) === o.role).length,
    };
  }, [offers]);

  const areDataLoading = isLoading || isUserLoading;

  if (!user && !isUserLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>My Offers</CardTitle>
            <CardDescription>Please sign in to view your offers.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/auth">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>My Offers</CardTitle>
            <CardDescription>
              {actionCount > 0
                ? `${actionCount} ${actionCount === 1 ? 'offer needs' : 'offers need'} your reply.`
                : 'Offers you have made, and offers on your listings.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-4">{error}</p>}
            <Tabs defaultValue={received.length > 0 ? 'received' : 'sent'} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="received">Received ({received.length})</TabsTrigger>
                <TabsTrigger value="sent">Sent ({sent.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="received" className="mt-6">
                {areDataLoading ? (
                  <OffersSkeleton />
                ) : received.length > 0 ? (
                  <div className="space-y-4">
                    {received.map((offer) => (
                      <OfferListItem key={offer.id} offer={offer} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="Offers buyers make on your listings will appear here." />
                )}
              </TabsContent>
              <TabsContent value="sent" className="mt-6">
                {areDataLoading ? (
                  <OffersSkeleton />
                ) : sent.length > 0 ? (
                  <div className="space-y-4">
                    {sent.map((offer) => (
                      <OfferListItem key={offer.id} offer={offer} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="Offers you make on other people's items will appear here." />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
