'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, documentId, getDocs, QueryConstraint } from 'firebase/firestore';
import { useShoppingPreference } from '@/hooks/use-shopping-preference';
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

/**
 * Cache for the AI recommendation call, keyed by the taste profile that
 * produced it.
 *
 * This is the only AI call on the highest-traffic page in the app, and the
 * Google free tier allows 20 generations *per day* for the whole project — so
 * without this, a handful of homepage visits by one signed-in shopper exhausts
 * the quota for every other feature, chat included.
 *
 * sessionStorage rather than a module variable so it survives navigation and
 * reloads, and rather than localStorage so a long-lived browser still refreshes
 * its picks eventually.
 */
const RECS_CACHE_KEY = 'marigo_reco_cache_v1';

type CachedRecommendation = { key: string; query: unknown; reasoning?: string };

function tasteKey(input: RecommendationInput, gender: string | null): string {
    return JSON.stringify({
        b: [...(input.wishlistedBrands ?? [])].sort(),
        c: [...(input.wishlistedCategories ?? [])].sort(),
        g: gender ?? '',
    });
}

function readCachedRecommendation(key: string): CachedRecommendation | null {
    try {
        const raw = sessionStorage.getItem(RECS_CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw) as CachedRecommendation;
        return cached?.key === key ? cached : null;
    } catch {
        return null;
    }
}

function writeCachedRecommendation(entry: CachedRecommendation): void {
    try {
        sessionStorage.setItem(RECS_CACHE_KEY, JSON.stringify(entry));
    } catch {
        // Private mode or a full quota — losing the cache only costs a retry.
    }
}

export function PersonalizedPicks() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { wishlistItems, isLoading: isWishlistLoading } = useWishlist();
    const gender = useShoppingPreference();

    const [recommendations, setRecommendations] = React.useState<{ products: FirestoreProduct[], title: string } | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const hasFetchedRef = React.useRef(false);

    // Reset the once-only fetch gate whenever the gender preference flips, so a
    // freshly-chosen audience triggers a new recommendation pull.
    React.useEffect(() => { hasFetchedRef.current = false; }, [gender]);

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
                    wishlistedBrands: [...new Set(wishlistProducts.map(p => p.brandId))],
                    wishlistedCategories: [...new Set(wishlistProducts.map(p => p.categoryId))],
                };

                if (tasteProfile.wishlistedBrands.length === 0 && tasteProfile.wishlistedCategories.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // 2. Get AI recommendations. Reuse the cached answer when the
                //    taste profile has not changed — the same wishlist always
                //    produces the same query, and generations are the scarcest
                //    resource in the app (20/day for the whole project).
                const key = tasteKey(tasteProfile, gender);
                const cached = readCachedRecommendation(key);
                const recommendationQuery = cached
                    ? { query: cached.query as Awaited<ReturnType<typeof getRecommendations>>['query'], reasoning: cached.reasoning }
                    : await getRecommendations(tasteProfile);

                if (!cached) {
                    writeCachedRecommendation({
                        key,
                        query: recommendationQuery.query,
                        reasoning: recommendationQuery.reasoning,
                    });
                }

                // 3. Build and fetch recommended products
                const queryConstraints: QueryConstraint[] = [
                  where('status', 'in', ['active', 'reserved', 'sold']),
                ];

                // `brandId` / `categoryId` — NOT `brand` / `category`. Product
                // documents have never carried the short names, so the old
                // filters matched nothing and this section silently rendered
                // empty while still paying for the AI call above.
                if (recommendationQuery.query.brands && recommendationQuery.query.brands.length > 0) {
                    queryConstraints.push(where('brandId', 'in', recommendationQuery.query.brands.slice(0, 10)));
                } else if (recommendationQuery.query.categories && recommendationQuery.query.categories.length > 0) {
                    queryConstraints.push(where('categoryId', 'in', recommendationQuery.query.categories.slice(0, 10)));
                }

                if (queryConstraints.length <= 1) {
                    setIsLoading(false);
                    return;
                }

                queryConstraints.push(limit(12));

                const recommendedProductsSnapshot = await getDocs(query(productsRef, ...queryConstraints));
                // Respect the visitor's gender preference. We filter client-side
                // here (rather than adding a where('gender', ...) clause) because
                // we already have a `where('brand'|'category', 'in', …)` clause —
                // Firestore allows only one `in` filter per query.
                const fetchedProducts = recommendedProductsSnapshot.docs
                    .map(d => ({ id: d.id, ...d.data() } as FirestoreProduct))
                    .filter(p => !wishlistedProductIds.includes(p.id))
                    .filter(p => !gender || p.gender === gender || p.gender === 'unisex');

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

    }, [user, firestore, wishlistItems, isWishlistLoading, gender]);
    
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
                            originalPrice: p.originalPrice,
                            images: p.images,
                            sellerId: p.sellerId,
                            size: p.size,
                            condition: p.condition,
                            color: p.color,
                            vintage: p.vintage,
                            status: p.status,
                        }} />
                    ))}
                </div>
            )}
        </section>
    )
}
