'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, documentId, getDocs, QueryConstraint } from 'firebase/firestore';
import type { FirestoreProduct, FirestoreUser } from '@/lib/types';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { getRecommendations, RecommendationInput } from '@/ai/flows/get-recommendations';
import { useWishlist } from '@/context/WishlistContext';

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

    React.useEffect(() => {
        if (!user || isWishlistLoading) {
            if (!isWishlistLoading) setIsLoading(false);
            return;
        }

        const generateAndFetchRecommendations = async () => {
            setIsLoading(true);

            if (wishlistItems.length === 0) {
                setIsLoading(false);
                return;
            }

            try {
                // 1. Build user taste profile from wishlist
                const wishlistedProductIds = wishlistItems.map(item => item.id);
                const productsRef = collection(firestore, 'products');
                const q = query(productsRef, where(documentId(), 'in', wishlistedProductIds.slice(0, 10)));
                const wishlistProductsSnapshot = await getDocs(q);
                const wishlistProducts = wishlistProductsSnapshot.docs.map(doc => doc.data() as FirestoreProduct);

                const tasteProfile: RecommendationInput = {
                    wishlistedBrands: [...new Set(wishlistProducts.map(p => p.brand))],
                    wishlistedCategories: [...new Set(wishlistProducts.map(p => p.category))],
                };
                
                if (tasteProfile.wishlistedBrands.length === 0 && tasteProfile.wishlistedCategories.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // 2. Get recommendation query from AI
                const recommendationQuery = await getRecommendations(tasteProfile);
                
                // 3. Fetch products based on AI query
                const queryConstraints: QueryConstraint[] = [];
                if (recommendationQuery.query.brands && recommendationQuery.query.brands.length > 0) {
                    queryConstraints.push(where('brand', 'in', recommendationQuery.query.brands.slice(0, 10)));
                }
                if (recommendationQuery.query.categories && recommendationQuery.query.categories.length > 0) {
                    queryConstraints.push(where('category', 'in', recommendationQuery.query.categories.slice(0, 10)));
                }

                if (queryConstraints.length === 0) {
                    setIsLoading(false);
                    return;
                }
                
                queryConstraints.push(where('status', '==', 'active'));
                // Exclude items already in the user's wishlist
                if (wishlistedProductIds.length > 0) {
                    // 'not-in' queries are limited to 10 items. This is a potential issue but fine for a demo.
                    queryConstraints.push(where(documentId(), 'not-in', wishlistedProductIds.slice(0, 10)));
                }
                queryConstraints.push(limit(10));

                const finalQuery = query(productsRef, ...queryConstraints);
                const recommendedProductsSnapshot = await getDocs(finalQuery);
                
                const products = recommendedProductsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreProduct));

                setRecommendations({
                    products: products,
                    title: recommendationQuery.reasoning || "Picks for You"
                });

            } catch (error) {
                console.error("Failed to get personalized recommendations:", error);
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
         <section>
            <h2 className="text-xl md:text-2xl font-serif mb-6">
                {isLoading ? 'Curating your picks...' : recommendations?.title}
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
                            brand: p.brand,
                            title: p.title,
                            price: p.price,
                            image: p.images?.[0] || '',
                            sellerId: p.sellerId,
                            size: p.size,
                            condition: p.condition as any,
                            color: p.color,
                            vintage: p.vintage,
                        }} />
                    ))}
                </div>
            )}
        </section>
    )
}
