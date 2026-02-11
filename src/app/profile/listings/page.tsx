'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';

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

function ListingsSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-24 w-24 rounded-md" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
             <div className="flex items-center space-x-4">
                <Skeleton className="h-24 w-24 rounded-md" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-10">
            <h3 className="text-lg font-semibold">No listings found</h3>
            <p className="text-muted-foreground mt-2">You haven't listed any items in this category yet.</p>
            <Button asChild className="mt-4">
                <Link href="/sell">Sell an Item</Link>
            </Button>
        </div>
    )
}

export default function ListingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [user, firestore]);
  
  const { data: listings, isLoading: areListingsLoading } = useCollection<FirestoreProduct>(productsQuery);

  const { active, sold, inactive } = React.useMemo(() => {
    const listingsData = listings || [];
    return {
      active: listingsData.filter(l => l.status === 'active'),
      sold: listingsData.filter(l => l.status === 'sold'),
      inactive: listingsData.filter(l => !['active', 'sold'].includes(l.status)),
    };
  }, [listings]);

  const isLoading = isUserLoading || areListingsLoading;
  
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
            <div className="mb-4">
                 <Button asChild variant="outline">
                    <Link href="/profile">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Profile
                    </Link>
                 </Button>
            </div>
          <Card>
            <CardHeader>
              <CardTitle>My Listings</CardTitle>
              <CardDescription>
                Manage your active, sold, and inactive product listings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
                  <TabsTrigger value="sold">Sold ({sold.length})</TabsTrigger>
                  <TabsTrigger value="inactive">Inactive ({inactive.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="active" className="mt-6">
                    {isLoading ? <ListingsSkeleton /> : 
                        active.length > 0 ? (
                            <div className="space-y-4">
                                {active.map(product => <ListingItem key={product.id} product={product} />)}
                            </div>
                        ) : <EmptyState />
                    }
                </TabsContent>
                <TabsContent value="sold" className="mt-6">
                     {isLoading ? <ListingsSkeleton /> : 
                        sold.length > 0 ? (
                            <div className="space-y-4">
                                {sold.map(product => <ListingItem key={product.id} product={product} />)}
                            </div>
                        ) : <EmptyState />
                    }
                </TabsContent>
                <TabsContent value="inactive" className="mt-6">
                     {isLoading ? <ListingsSkeleton /> : 
                        inactive.length > 0 ? (
                            <div className="space-y-4">
                                {inactive.map(product => <ListingItem key={product.id} product={product} />)}
                            </div>
                        ) : <EmptyState />
                    }
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
