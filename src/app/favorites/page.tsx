'use client';

import * as React from 'react';
import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Product } from '@/lib/mock-data';
import { HeartOff, ChevronDown, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useWishlist } from '@/context/WishlistContext';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import type { FirestoreProduct } from '@/lib/types';


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
    const { user, isUserLoading } = useUser();
    const { wishlistItems, isLoading: isWishlistLoading } = useWishlist();
    const router = useRouter();
    const firestore = useFirestore();
    const [favoriteProducts, setFavoriteProducts] = React.useState<(Product & { addedAt: any })[]>([]);
    const [isProductsLoading, setIsProductsLoading] = React.useState(true);
    
    React.useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/auth');
        }
    }, [user, isUserLoading, router]);

    React.useEffect(() => {
      if (isWishlistLoading || !firestore) return;
      
      if (wishlistItems.length === 0) {
        setIsProductsLoading(false);
        setFavoriteProducts([]);
        return;
      }

      const fetchProducts = async () => {
        setIsProductsLoading(true);
        const productIds = wishlistItems.map(item => item.id);
        const productsData: (Product & { addedAt: any })[] = [];
        
        // Firestore 'in' query is limited to 10 items per query.
        const chunks: string[][] = [];
        for (let i = 0; i < productIds.length; i += 10) {
            chunks.push(productIds.slice(i, i + 10));
        }
        
        try {
          for (const chunk of chunks) {
            if (chunk.length > 0) {
              const q = query(collection(firestore, 'products'), where(documentId(), 'in', chunk));
              const querySnapshot = await getDocs(q);
              querySnapshot.forEach((doc) => {
                const firestoreProduct = { id: doc.id, ...doc.data() } as FirestoreProduct;
                const wishlistItem = wishlistItems.find(item => item.id === doc.id);
                if (wishlistItem) {
                  productsData.push({
                    id: firestoreProduct.id,
                    brand: firestoreProduct.brand,
                    title: firestoreProduct.title,
                    price: firestoreProduct.price,
                    image: firestoreProduct.images?.[0] || '',
                    sellerId: firestoreProduct.sellerId,
                    size: firestoreProduct.size,
                    condition: firestoreProduct.condition as any,
                    color: firestoreProduct.color,
                    vintage: firestoreProduct.vintage,
                    addedAt: wishlistItem.addedAt,
                  });
                }
              });
            }
          }
          setFavoriteProducts(productsData);
        } catch (error) {
          console.error("Error fetching favorite products:", error);
        } finally {
          setIsProductsLoading(false);
        }
      };

      fetchProducts();
    }, [wishlistItems, isWishlistLoading, firestore]);
    
    const sortedProducts = React.useMemo(() => {
        const products = [...favoriteProducts];
        switch(sortOption) {
            case 'price_asc':
                return products.sort((a,b) => a.price - b.price);
            case 'price_desc':
                return products.sort((a,b) => b.price - a.price);
            case 'newest':
            default:
                if (products.every(p => p.addedAt?.seconds)) {
                    return products.sort((a, b) => b.addedAt.seconds - a.addedAt.seconds);
                }
                return products;
        }
    }, [favoriteProducts, sortOption]);

    const isLoading = isUserLoading || isProductsLoading;
    
    if (isLoading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!user) {
        return null; // Render nothing while redirecting
    }

    return (
    <div className="container mx-auto px-0 sm:px-4 py-4 md:py-8">
      <div className="flex justify-between items-center mb-4 px-4 sm:px-0">
        <div>
            <h1 className="text-lg font-bold uppercase tracking-wide">
            Favorites
            </h1>
            <p className="text-sm text-muted-foreground">{sortedProducts.length} item{sortedProducts.length !== 1 ? 's' : ''}</p>
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
        {sortedProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {sortedProducts.map((product) => (
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
