'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product-card';
import type { Product } from '@/lib/mock-data';
import { Bookmark, SlidersHorizontal, Search } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, type QueryConstraint, limit } from 'firebase/firestore';
import type { FirestoreProduct } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

function ProductCardSkeleton() {
    return (
        <div className="space-y-2">
            <Skeleton className="aspect-[3/4] w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-1/3" />
        </div>
    )
}


function ProductListPage() {
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  
  const category = searchParams.get('category');
  const brand = searchParams.get('brand');
  const section = searchParams.get('section');
  
  let title = 'Products';
  if (category) title = category.replace(/-/g, ' ');
  if (brand) title = brand.replace(/-/g, ' ');
  if (section === 'new-arrivals') {
    title = 'New Arrivals';
  } else if (section) {
    title = section.replace(/-/g, ' ');
  }


  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;

    const baseQuery = collection(firestore, 'products');
    const queryConstraints: QueryConstraint[] = [where('status', '==', 'active')];
    
    if (category) {
      queryConstraints.push(where('category', '==', category));
    }
    if (brand) {
      queryConstraints.push(where('brand', '==', brand));
    }
    if (section === 'new-arrivals') {
        queryConstraints.push(orderBy('listingCreated', 'desc'));
    }

    queryConstraints.push(limit(50)); // Limit query results for performance

    return query(baseQuery, ...queryConstraints);
  }, [firestore, category, brand, section]);

  const { data: products, isLoading } = useCollection<FirestoreProduct>(productsQuery);

  const productsToShow: Product[] = React.useMemo(() => {
    if (!products) return [];
    return products.map(p => ({
        id: p.id,
        brand: p.brand,
        title: p.title,
        price: p.price,
        image: p.images?.[0] || '',
        sellerId: p.sellerId,
        size: p.size,
        condition: p.condition as any,
        color: p.color,
        vintage: p.vintage,
    }));
  }, [products]);

  return (
    <div className="flex flex-col bg-background">
        <main className="flex-1">
            <div className="container px-4 py-4">
                
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-xl font-bold uppercase">{ isLoading ? 'Loading...' : title }</h1>
                        { !isLoading && <p className="text-sm text-muted-foreground">{productsToShow.length}+ items</p> }
                    </div>
                     <Button variant="outline" className="shrink-0">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Filters
                    </Button>
                </div>

                {isLoading ? (
                     <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-6">
                        {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
                    </div>
                ) : productsToShow.length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-6">
                        {productsToShow.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                     <div className="text-center py-20">
                        <h2 className="text-xl font-semibold">No products found</h2>
                        <p className="mt-2 text-muted-foreground">Try adjusting your search or filters.</p>
                    </div>
                )}
            </div>
        </main>
    </div>
  );
}

function SearchLandingPage() {
    const recentSearches = [
        {
            id: 1,
            query: 'Women - Chanel Timeless',
            newCount: 99,
        }
    ];

    return (
        <div className="flex flex-col h-full bg-background p-4">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    placeholder="Search for items, members..." 
                    className="pl-11 h-11 rounded-full text-base"
                    autoFocus
                />
            </div>
            
            <Tabs defaultValue="items" className="w-full mt-4 flex flex-col flex-1">
                <TabsList className="grid w-full grid-cols-2 rounded-none bg-background border-b h-12">
                    <TabsTrigger value="items" className="text-base h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">Items</TabsTrigger>
                    <TabsTrigger value="members" className="text-base h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">Members</TabsTrigger>
                </TabsList>
                <TabsContent value="items" className="p-4 space-y-6">
                     <div className="flex justify-between items-center">
                        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Recent Searches</h2>
                        <Button variant="ghost" className="h-auto p-0 text-sm text-muted-foreground">Edit</Button>
                    </div>
                    <ul className="space-y-4">
                        {recentSearches.map(search => (
                             <li key={search.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                   <p className="font-medium text-base">{search.query}</p>
                                   {search.newCount > 0 && (
                                       <Badge variant="destructive" className="rounded-sm font-bold">
                                        {`+${search.newCount} NEW`}
                                       </Badge>
                                   )}
                                </div>
                                <Button variant="ghost" size="icon" className="text-muted-foreground">
                                    <Bookmark className="h-5 w-5" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </TabsContent>
                <TabsContent value="members" className="p-4 text-center text-muted-foreground">
                    <p>Search for members by username.</p>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Main component that decides which view to render
function SearchPageContents() {
    const searchParams = useSearchParams();
    const hasQuery = Array.from(searchParams.keys()).length > 0;

    if (hasQuery) {
        return <ProductListPage />;
    }
    
    return <SearchLandingPage />;
}


export default function SearchPage() {
    return (
        <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-background"><div className="dot-flashing"></div></div>}>
            <SearchPageContents />
        </React.Suspense>
    )
}
