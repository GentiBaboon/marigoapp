
'use client';

import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { newArrivals, trendingProducts, outletProducts } from '@/lib/mock-data';
import type { Product } from '@/lib/mock-data';
import { HeartOff } from 'lucide-react';
import Link from 'next/link';

// Combine all mock products for demonstration and remove duplicates
const combinedProducts = [...newArrivals, ...trendingProducts, ...outletProducts.slice(0, 2)];
const allFavoriteProducts: Product[] = Array.from(new Map(combinedProducts.map(p => [p.id, p])).values());


// Mock data for other categories
const clothes: Product[] = allFavoriteProducts.filter(p => p.id === '3' || p.id === '4');
const shoes: Product[] = allFavoriteProducts.filter(p => p.id === '6');
const bags: Product[] = allFavoriteProducts.filter(p => p.id === '1' || p.id === '2' || p.id === '5' || p.id === '7' || p.id === '8');
const accessories: Product[] = []; // Empty for empty state demo

const favoriteCategories = [
  { value: 'all', label: 'All', products: allFavoriteProducts },
  { value: 'clothes', label: 'Clothes', products: clothes },
  { value: 'shoes', label: 'Shoes', products: shoes },
  { value: 'bags', label: 'Bags', products: bags },
  { value: 'accessories', label: 'Accessories', products: accessories },
];

const EmptyFavorites = () => (
  <div className="text-center py-20 flex flex-col items-center">
    <HeartOff className="mx-auto h-16 w-16 text-muted-foreground" />
    <h2 className="mt-6 text-xl font-semibold">No favorites yet</h2>
    <p className="mt-2 text-muted-foreground max-w-xs">
      Tap the heart on any item to save it to your favorites.
    </p>
    <Button asChild className="mt-6">
      <Link href="/home">Find your next favorite</Link>
    </Button>
  </div>
);

export default function FavoritesPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-headline font-bold">
          My Favorites
        </h1>
        <p className="text-muted-foreground mt-2">
          Your curated collection of luxury finds.
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <div className="flex justify-center">
            <TabsList className="grid grid-cols-3 sm:grid-cols-5 max-w-xl">
              {favoriteCategories.map((cat) => (
                <TabsTrigger key={cat.value} value={cat.value}>
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
        </div>
        {favoriteCategories.map((cat) => (
          <TabsContent key={cat.value} value={cat.value} className="mt-8">
            {cat.products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {cat.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <EmptyFavorites />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
