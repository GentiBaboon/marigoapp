'use client';

import * as React from 'react';
import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Product } from '@/lib/mock-data';
import { HeartOff, ChevronDown } from 'lucide-react';
import Link from 'next/link';

// Let's create a new mock product that matches the image
const bossBoots: Product = {
  id: 'boss-boots-1',
  brand: 'BOSS',
  title: 'Boots',
  price: 63,
  originalPrice: 69,
  image: 'product-10', // using a sneaker image for now as a placeholder
  sellerId: 'seller-x',
  size: '42 EU',
  sellerLocation: 'Italy'
};

const favoriteProducts: Product[] = [bossBoots];


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

const FilterButton = ({ label }: { label: string }) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-1 shrink-0">
                {label} <ChevronDown className="h-4 w-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
            {/* Placeholder content */}
            <DropdownMenuRadioGroup value="placeholder">
                <DropdownMenuRadioItem value="placeholder">Coming Soon</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
        </DropdownMenuContent>
    </DropdownMenu>
);

export default function FavoritesPage() {
    const [sortOption, setSortOption] = React.useState('newest');

  return (
    <div className="container mx-auto px-0 sm:px-4 py-4 md:py-8">
      <div className="flex justify-between items-center mb-4 px-4 sm:px-0">
        <div>
            <h1 className="text-lg font-bold uppercase tracking-wide">
            Favorites
            </h1>
            <p className="text-sm text-muted-foreground">{favoriteProducts.length} item</p>
        </div>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-1 text-sm font-medium">
                   Sort by <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={sortOption} onValueChange={setSortOption}>
                    <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="price_asc">Price: Low to High</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="price_desc">Price: High to Low</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-4 px-4 sm:px-0 border-b">
        <FilterButton label="Brand" />
        <FilterButton label="Category" />
        <FilterButton label="Color" />
        <FilterButton label="Condition" />
      </div>

      <div className="mt-6 px-4 sm:px-0">
        {favoriteProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {favoriteProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyFavorites />
        )}
      </div>
    </div>
  );
}
