'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product-card';
import { newArrivals, trendingProducts, outletProducts } from '@/lib/mock-data';
import type { Product } from '@/lib/mock-data';
import { ArrowLeft, Bookmark, SlidersHorizontal, ShoppingCart, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';

const allProducts = [...newArrivals, ...trendingProducts, ...outletProducts];

function ProductListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category') || 'Products';
  
  const categoryTitle = category.replace(/-/g, ' ').toUpperCase();

  const productsToShow = React.useMemo(() => {
    // Simple filter for demonstration. In a real app, you'd fetch filtered data.
    if (category === 'tote-bags') {
        return allProducts.filter(p => p.title.toLowerCase().includes('tote'));
    }
    return allProducts;
  }, [category]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container flex h-16 items-center gap-2 px-2 sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search for items, members..." className="pl-9" />
                </div>
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/cart">
                        <ShoppingCart />
                    </Link>
                </Button>
            </div>
        </header>

        <main className="flex-1">
            <div className="container px-4 py-4">
                <div className="bg-secondary/50 p-3 rounded-lg flex justify-between items-center text-sm mb-4">
                    <span>Use WELCOME15 for 15% off your first order over 100€ (app only).</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                
                <div className="flex justify-between items-center mb-2">
                    <div>
                        <h1 className="text-xl font-bold">{categoryTitle}</h1>
                        <p className="text-sm text-muted-foreground">999+ items</p>
                    </div>
                    <Button variant="ghost" className="text-sm font-semibold p-1 h-auto">
                        <Bookmark className="mr-2 h-4 w-4" />
                        Save this search
                    </Button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                    <Button variant="outline" className="border-2 border-foreground shrink-0">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="shrink-0">In Europe</Button>
                    <Button variant="outline" className="shrink-0">Reduced prices</Button>
                    <Button variant="outline" className="shrink-0">Brand</Button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-6">
                    {productsToShow.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
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
        <div className="flex flex-col h-screen bg-background">
            <header className="flex items-center p-2 md:p-4 border-b">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        placeholder="Search for items, members..." 
                        className="pl-11 h-11 rounded-full text-base"
                        autoFocus
                    />
                </div>
                <Button variant="ghost" asChild className="ml-2">
                    <Link href="/home">Close</Link>
                </Button>
            </header>
            
            <Tabs defaultValue="items" className="w-full">
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
    const hasQuery = searchParams.toString().length > 0;

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
