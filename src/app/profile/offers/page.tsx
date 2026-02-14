'use client';

import * as React from 'react';
import Link from 'next/link';
import { Handshake } from 'lucide-react';
import { collectionGroup, query, where, getDocs, getDoc, doc } from 'firebase/firestore';

import { useUser, useFirestore } from '@/firebase';
import type { FirestoreOffer, FirestoreProduct } from '@/lib/types';

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

export type OfferWithProduct = FirestoreOffer & { product: FirestoreProduct };

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

function EmptyState({ tab }: { tab: string }) {
    return (
        <div className="text-center py-10">
            <Handshake className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold mt-4">No {tab} offers</h3>
            <p className="text-muted-foreground mt-2">
                Your offers will appear here.
            </p>
        </div>
    )
}

export default function OffersPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [offers, setOffers] = React.useState<OfferWithProduct[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    
    React.useEffect(() => {
        if (!user || !firestore) {
            if (!isUserLoading) setIsLoading(false);
            return;
        }

        const fetchOffers = async () => {
            setIsLoading(true);
            try {
                const offersQuery = query(collectionGroup(firestore, 'offers'), where('buyerId', '==', user.uid));
                const offersSnapshot = await getDocs(offersQuery);
                
                const offersWithProductData: (OfferWithProduct | null)[] = await Promise.all(
                    offersSnapshot.docs.map(async (offerDoc) => {
                        const offerData = { id: offerDoc.id, ...offerDoc.data() } as FirestoreOffer;
                        // The parent of an offer is the product document
                        const productRef = offerDoc.ref.parent.parent;
                        if (!productRef) return null;

                        const productSnap = await getDoc(productRef);
                        if (!productSnap.exists()) return null;

                        const productData = { id: productSnap.id, ...productSnap.data() } as FirestoreProduct;
                        
                        return { ...offerData, product: productData };
                    })
                );
                
                const validOffers = offersWithProductData.filter((o): o is OfferWithProduct => o !== null)
                    .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

                setOffers(validOffers);

            } catch (error) {
                console.error("Error fetching offers:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOffers();
    }, [user, firestore, isUserLoading]);

    const { pending, active, closed } = React.useMemo(() => {
        return {
            pending: offers.filter(o => o.status === 'pending' || o.status === 'countered'),
            active: offers.filter(o => o.status === 'accepted'),
            closed: offers.filter(o => o.status === 'rejected' || o.status === 'expired' || o.status === 'withdrawn'),
        };
    }, [offers]);

    const areDataLoading = isLoading || isUserLoading;

    if (!user && !isUserLoading) {
     return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>My Offers</CardTitle>
              <CardDescription>
                Please sign in to view your offers.
              </CardDescription>
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
                Manage offers you've made on items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                  <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
                  <TabsTrigger value="closed">Closed ({closed.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="mt-6">
                    {areDataLoading ? <OffersSkeleton /> : 
                        pending.length > 0 ? (
                            <div className="space-y-4">
                                {pending.map(offer => <OfferListItem key={offer.id} offer={offer} />)}
                            </div>
                        ) : <EmptyState tab="pending" />
                    }
                </TabsContent>
                <TabsContent value="active" className="mt-6">
                     {areDataLoading ? <OffersSkeleton /> : 
                        active.length > 0 ? (
                            <div className="space-y-4">
                                {active.map(offer => <OfferListItem key={offer.id} offer={offer} />)}
                            </div>
                        ) : <EmptyState tab="active" />
                    }
                </TabsContent>
                <TabsContent value="closed" className="mt-6">
                     {areDataLoading ? <OffersSkeleton /> : 
                        closed.length > 0 ? (
                            <div className="space-y-4">
                                {closed.map(offer => <OfferListItem key={offer.id} offer={offer} />)}
                            </div>
                        ) : <EmptyState tab="closed" />
                    }
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
