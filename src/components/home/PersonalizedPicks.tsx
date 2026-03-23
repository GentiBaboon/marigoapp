'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, documentId, getDocs, QueryConstraint } from 'firebase/firestore';
import type { FirestoreProduct } from '@/lib/types';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { getRecommendations, RecommendationInput } from '@/ai/flows/get-recommendations';
import { useWishlist } from '@/context/WishlistContext';
import { Loader2 } from 'lucide-react';

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

export function PersonalizedPicks() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { wishlistItems, isLoading: isWishlistLoading } = useWishlist();

    const [recommendations, setRecommendations] = React.useState<{ products: FirestoreProduct[], title: string } | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const hasFetchedRef = React.useRef(false);

    React.useEffect(() => {
        // Prevent multiple simultaneous AI calls or re-fetches if data is already loaded for this user
        if (!user || isWishlistLoading || hasFetchedRef.current) {
            if (!isWishlistLoading && !user) setIsLoading(false);
            return;
        }

        const generateAndFetchRecommendations = async () => {
            if (wishlistItems.length === 0) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            hasFetchedRef.current = true;

            try {
                // 1. Build user taste profile from wishlist
                const wishlistedProductIds = wishlistItems.map(item => item.id).slice(0, 10);
                const productsRef = collection(firestore, 'products');
                
                const wishlistProductsSnapshot = await getDocs(query(productsRef, where(documentId(), 'in', wishlistedProductIds)));
                const wishlistProducts = wishlistProductsSnapshot.docs.map(doc => doc.data() as FirestoreProduct);

                const tasteProfile: RecommendationInput = {
                    wishlistedBrands: [...new Set(wishlistProducts.map(p => p.brand))],
                    wishlistedCategories: [...new Set(wishlistProducts.map(p => p.category))],
                };
                
                if (tasteProfile.wishlistedBrands.length === 0 && tasteProfile.wishlistedCategories.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // 2. Get recommendation query from AI (Latency optimized)
                const recommendationQuery = await getRecommendations(tasteProfile);
                
                // 3. Fetch products based on AI query
                const queryConstraints: QueryConstraint[] = [where('status', '==', 'active')];
                
                if (recommendationQuery.query.brands && recommendationQuery.query.brands.length > 0) {
                    queryConstraints.push(where('brand', 'in', recommendationQuery.query.brands.slice(0, 10)));
                } else if (recommendationQuery.query.categories && recommendationQuery.query.categories.length > 0) {
                    queryConstraints.push(where('category', 'in', recommendationQuery.query.categories.slice(0, 10)));
                }

                if (queryConstraints.length <= 1) {
                    setIsLoading(false);
                    return;
                }
                
                queryConstraints.push(limit(12));

                const recommendedProductsSnapshot = await getDocs(query(productsRef, ...queryConstraints));
                const fetchedProducts = recommendedProductsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as FirestoreProduct))
                    .filter(p => !wishlistedProductIds.includes(p.id)); // Exclude already wishlisted

                setRecommendations({
                    products: fetchedProducts.slice(0, 8),
                    title: recommendationQuery.reasoning || "Curated for You"
                });

            } catch (error) {
                console.warn("Failed to get personalized recommendations:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        generateAndFetchRecommendations();

    }, [user, firestore, wishlistItems, isWishlistLoading]);
    
    if (!user || (!isLoading && (!recommendations || recommendations.products.length === 0))) {
        return null;
    }

    return (
         <section className="animate-in fade-in duration-700">
            <h2 className="text-xl md:text-2xl font-serif mb-6 flex items-center gap-2">
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        Curating your picks...
                    </span>
                ) : recommendations?.title}
            </h2>
            
            {isLoading ? (
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
                    {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
                    {recommendations?.products.map((p) => (
                        <ProductCard key={p.id} product={{
                            id: p.id,
                            brandId: p.brandId,
                            title: p.title,
                            price: p.price,
                            images: p.images,
                            sellerId: p.sellerId,
                            size: p.size,
                            condition: p.condition,
                            color: p.color,
                            vintage: p.vintage,
                        }} />
                    ))}
                </div>
            )}
        </section>
    )
}
