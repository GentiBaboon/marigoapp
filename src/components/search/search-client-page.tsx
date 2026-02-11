'use client';

import * as React from 'react';
import {
  Sidebar,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { SearchSidebarContent } from '@/components/search/search-sidebar-content';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ProductCard } from '@/components/product-card';
import { newArrivals, trendingProducts } from '@/lib/mock-data';
import { ListFilter, Search as SearchIcon, ChevronDown } from 'lucide-react';
import { Product } from '@/lib/mock-data';

const allProducts = [...newArrivals, ...trendingProducts];

export function SearchClientPage() {
  const [sortOption, setSortOption] = React.useState('newest');
  const [products, setProducts] = React.useState<Product[]>(allProducts);
  const recentSearches = ['chanel bag', 'gucci loafers', 'prada dress', 'dior sunglasses'];

  React.useEffect(() => {
    const sortedProducts = [...allProducts].sort((a, b) => {
      switch (sortOption) {
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'newest':
        default:
          return parseInt(b.id) - parseInt(a.id);
      }
    });
    setProducts(sortedProducts);
  }, [sortOption]);

  return (
    <>
      <Sidebar variant="floating" collapsible="icon" className="w-80" side="left">
        <SearchSidebarContent />
      </Sidebar>
      <SidebarInset className="min-h-[calc(100vh-8rem)] p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex w-full items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <h1 className="font-headline text-3xl font-bold">Search</h1>
          </div>
          <div className="flex w-full md:w-auto items-center justify-end gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Sort By{' '}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuRadioGroup
                  value={sortOption}
                  onValueChange={setSortOption}
                >
                  <DropdownMenuRadioItem value="newest">
                    Newest
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="most-popular">
                    Most Popular
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="price-asc">
                    Price: Low to High
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="price-desc">
                    Price: High to Low
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="icon" variant="outline" className="md:hidden" asChild>
                <SidebarTrigger />
            </Button>
          </div>
        </div>

        <div className="relative w-full max-w-3xl mx-auto mb-8">
          <Input
            placeholder="Search for items, brands, and designers"
            className="pl-10 h-12 text-base rounded-full"
          />
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>

        <div className="mb-10 max-w-3xl mx-auto">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Recent Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search) => (
              <Button key={search} variant="outline" size="sm" className="rounded-full">
                {search}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </SidebarInset>
    </>
  );
}
