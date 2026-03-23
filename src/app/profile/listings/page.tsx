
'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct, FirestoreOrder } from '@/lib/types';
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
import { ListingItem } from '@/components/profile/listing-item';
import { Tag } from 'lucide-react';

function ListingsSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 rounded-md border p-4">
                    <Skeleton className="h-20 w-20 rounded-md" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ title, description }: { title: string, description: string }) {
    return (
        <div className="text-center py-16 px-4 border-2 border-dashed rounded-xl">
            <div className="bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-muted-foreground mt-1 max-w-xs mx-auto text-sm">{description}</p>
            <Button asChild className="mt-6 rounded-full" variant="outline">
                <Link href="/sell">List an Item</Link>
            </Button>
        </div>
    )
}

export default function ListingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Query for products owned by user
  const productsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'products'), 
        where('sellerId', '==', user.uid),
        orderBy('listingCreated', 'desc')
    );
  }, [user, firestore]);

  const { data: listings, isLoading: areListingsLoading } = useCollection<FirestoreProduct>(productsQuery);

  // Query for orders where user is a seller
  const salesQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      return query(
          collection(firestore, 'orders'),
          where('sellerIds', 'array-contains', user.uid)
      );
  }, [user, firestore]);

  const { data: sales, isLoading: areSalesLoading } = useCollection<FirestoreOrder>(salesQuery);

  const { active, sold, inactive } = React.useMemo(() => {
    const listingsData = listings || [];
    return {
      active: listingsData.filter(l => l.status === 'active'),
      sold: sales || [], 
      inactive: listingsData.filter(l => !['active', 'sold'].includes(l.status)),
    };
  }, [listings, sales]);

  const isLoading = isUserLoading || areListingsLoading || areSalesLoading;
  
  if (!user && !isUserLoading) {
     return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>My Listings</CardTitle>
              <CardDescription>
                Please sign in to view your product listings.
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
          <div className="mb-8">
              <h1 className="text-3xl font-bold font-headline">My Listings</h1>
              <p className="text-muted-foreground">Manage your boutique and track fulfillment.</p>
          </div>

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50 rounded-full p-1 mb-8">
              <TabsTrigger value="active" className="rounded-full">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="sold" className="rounded-full">Sold ({sold.length})</TabsTrigger>
              <TabsTrigger value="inactive" className="rounded-full">Inactive ({inactive.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active">
                {isLoading ? <ListingsSkeleton /> : 
                    active.length > 0 ? (
                        <div className="space-y-4">
                            {active.map(product => <ListingItem key={product.id} product={product} />)}
                        </div>
                    ) : <EmptyState title="No active items" description="You don't have any items for sale right now." />
                }
            </TabsContent>
            
            <TabsContent value="sold">
                 {isLoading ? <ListingsSkeleton /> : 
                    sold.length > 0 ? (
                        <div className="space-y-4">
                            {sold.map(order => <ListingItem key={order.id} order={order} />)}
                        </div>
                    ) : <EmptyState title="No sales yet" description="Your sold items will appear here for fulfillment tracking." />
                }
            </TabsContent>
            
            <TabsContent value="inactive">
                 {isLoading ? <ListingsSkeleton /> : 
                    inactive.length > 0 ? (
                        <div className="space-y-4">
                            {inactive.map(product => <ListingItem key={product.id} product={product} />)}
                        </div>
                    ) : <EmptyState title="No inactive items" description="Drafts or expired listings would be shown here." />
                }
            </TabsContent>
          </Tabs>
        </div>
    </div>
  );
}
