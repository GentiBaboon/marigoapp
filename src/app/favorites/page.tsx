'use client';

import * as React from 'react';
import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeartOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useWishlist } from '@/context/WishlistContext';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import type { FirestoreProduct } from '@/lib/types';

const categories = [
  { id: 'all', label: 'All' },
  { id: 'clothing', label: 'Clothes' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'bags', label: 'Bags' },
  { id: 'accessories', label: 'Accessories' },
];

const EmptyFavorites = () => (
  <div className="text-center py-20 flex flex-col items-center">
    <div className="bg-muted/30 p-6 rounded-full mb-6">
      <HeartOff className="h-12 w-12 text-muted-foreground" />
    </div>
    <h2 className="text-2xl font-bold font-headline mb-2">No favorites yet</h2>
    <p className="text-muted-foreground max-w-xs mb-8">
      Tap the heart on any item to save it to your favorites and keep track of what you love.
    </p>
    <Button asChild size="lg" className="rounded-full px-8">
      <Link href="/home">Find your next favorite</Link>
    </Button>
  </div>
);

export default function FavoritesPage() {
    const { user, isUserLoading } = useUser();
    const { wishlistItems, isLoading: isWishlistLoading } = useWishlist();
    const router = useRouter();
    const firestore = useFirestore();
    const [favoriteProducts, setFavoriteProducts] = React.useState<FirestoreProduct[]>([]);
    const [isProductsLoading, setIsProductsLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('all');
    
    React.useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/auth');
        }
    }, [user, isUserLoading, router]);

    React.useEffect(() => {
      if (isWishlistLoading || !firestore || !user) return;
      
      if (wishlistItems.length === 0) {
        setIsProductsLoading(false);
        setFavoriteProducts([]);
        return;
      }

      const fetchProducts = async () => {
        setIsProductsLoading(true);
        const productIds = wishlistItems.map(item => item.id);
        
        // Firestore 'in' query is limited to 10 items. Chunks if needed.
        const chunks: string[][] = [];
        for (let i = 0; i < productIds.length; i += 10) {
            chunks.push(productIds.slice(i, i + 10));
        }
        
        try {
          const results: FirestoreProduct[] = [];
          for (const chunk of chunks) {
            if (chunk.length > 0) {
              const q = query(collection(firestore, 'products'), where(documentId(), 'in', chunk));
              const querySnapshot = await getDocs(q);
              querySnapshot.forEach((doc) => {
                results.push({ id: doc.id, ...doc.data() } as FirestoreProduct);
              });
            }
          }
          setFavoriteProducts(results);
        } catch (error) {
          console.error("Error fetching favorite products:", error);
        } finally {
          setIsProductsLoading(false);
        }
      };

      fetchProducts();
    }, [wishlistItems, isWishlistLoading, firestore, user]);
    
    const filteredProducts = React.useMemo(() => {
        if (activeTab === 'all') return favoriteProducts;
        return favoriteProducts.filter(p => p.categoryId?.toLowerCase() === activeTab.toLowerCase());
    }, [favoriteProducts, activeTab]);

    const isLoading = isUserLoading || isProductsLoading;
    
    if (isLoading) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) return null;

    return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold font-headline">Favorites</h1>
        <p className="text-muted-foreground">{favoriteProducts.length} items saved</p>
      </div>

      <Tabs defaultValue="all" onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 mb-8 space-x-8">
          {categories.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-4 text-base font-medium"
            >
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (activeTab === 'all' ? (
            <EmptyFavorites />
          ) : (
            <div className="text-center py-20">
                <p className="text-muted-foreground italic">No favorites found in this category.</p>
            </div>
          ))}
        </div>
      </Tabs>
    </div>
    );
}