'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { doc, setDoc, deleteDoc, collection, getDocs, onSnapshot, writeBatch, query, where, limit } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import type { FirestoreCoupon, FirestoreSettings } from '@/lib/types';
import { validateCoupon, computeDiscount } from '@/lib/coupons';
import { DEFAULT_SHIPPING_FEE_EUR } from '@/lib/types';
import { calculateShipping, type ShippingGroup } from '@/lib/shipping';

export type ShippingMethod = 'direct' | 'authentication';

export type CartItem = {
    // Unique cart-line id. For variant products this is `${productId}__${size}`
    // so the same product in two different sizes appears as two separate lines.
    // For non-variant products it equals the productId. Used as the Firestore
    // doc id under users/{uid}/cart/{id} and as the React key in lists.
    id: string;
    // The underlying product id (always the original product doc id, even for
    // variant lines). Use this to navigate to /products/{productId} and for
    // checkout stock lookups. Optional only because legacy cart entries saved
    // before this field existed may not have it — at runtime treat `id` as
    // the productId in that case.
    productId?: string;
    brand: string;
    title: string;
    price: number;
    /**
     * The listing's pre-markdown price, only when it is higher than `price`,
     * so the cart and checkout can show the saving. Absent on lines added
     * before the field existed.
     */
    originalPrice?: number;
    image: string;
    sellerId: string;
    quantity: number;
    // Maximum available stock for this listing — used to cap cart quantity.
    // Optional so legacy cart entries (saved before the field existed) still load.
    stock?: number;
    selectedSize?: string | null;
    selectedColor?: string | null;
    shippingMethod: ShippingMethod;
    directShippingFee: number;
    /**
     * City this line ships from, copied off the product. Drives the per-city
     * delivery fee. Optional: listings published before the field existed have
     * none, and are pooled into a single shared origin.
     */
    shippingFromCity?: string | null;
    /** Origin country, for the domestic vs cross-border rate. */
    shippingFromCountry?: string | null;
};

// Build a stable cart-line id from a product id + size. Items without a size
// keep the productId as their line id (legacy compatibility).
const buildLineId = (productId: string, size?: string | null) =>
    size && size.trim() ? `${productId}__${size.trim()}` : productId;

interface CartContextType {
    items: CartItem[];
    addToCart: (product: any, options?: { quantity?: number, selectedSize?: string, selectedColor?: string }) => void;
    removeFromCart: (itemId: string) => void;
    updateQuantity: (itemId: string, quantity: number) => void;
    clearCart: () => void;
    applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
    removeCoupon: () => void;
    appliedCoupon: FirestoreCoupon | null;
    discountAmount: number;
    subtotal: number;
    totalItems: number;
    totalShipping: number;
    /** Per-origin-city delivery breakdown, for the order summary. */
    shippingGroups: ShippingGroup[];
    grandTotal: number;
    isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [appliedCoupon, setAppliedCoupon] = useState<FirestoreCoupon | null>(null);
    const [settings, setSettings] = useState<FirestoreSettings | null>(null);
    
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    /**
     * Where the order is going. Crossing the Albania–Kosovo border costs more,
     * so the quote needs the destination as well as the origins.
     *
     * Taken from the buyer's default address, and only fetched once there is
     * something in the basket — CartProvider wraps every page, and a shopper
     * with an empty cart should not be paying for an address read.
     *
     * `create-order` recomputes this from the address actually submitted, so a
     * buyer who picks a different address at checkout is charged correctly even
     * if this quote was based on their default.
     */
    const [destinationCountry, setDestinationCountry] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !firestore || items.length === 0) return;
        let cancelled = false;
        getDocs(collection(firestore, 'users', user.uid, 'addresses'))
            .then(snap => {
                if (cancelled) return;
                const docs = snap.docs.map(d => d.data() as { country?: string; isDefault?: boolean });
                const chosen = docs.find(a => a.isDefault) ?? docs[0];
                setDestinationCountry(chosen?.country ?? null);
            })
            .catch(() => { /* Quote falls back to the domestic rate. */ });
        return () => { cancelled = true; };
    }, [user, firestore, items.length]);

    // Load global settings (for free delivery thresholds)
    useEffect(() => {
        if (!firestore) return;
        return onSnapshot(doc(firestore, 'settings', 'global'), (snap) => {
            if (snap.exists()) setSettings(snap.data() as FirestoreSettings);
        });
    }, [firestore]);

    // 1. Initial Load from LocalStorage (for guests)
    useEffect(() => {
        if (!user) {
            const savedCart = localStorage.getItem('marigo_cart');
            if (savedCart) {
                try {
                    setItems(JSON.parse(savedCart));
                } catch (e) {
                    console.error("Failed to parse local cart", e);
                }
            }
            setIsLoading(false);
        }
    }, [user]);

    // 2. Sync with Firestore if logged in
    useEffect(() => {
        if (!user || !firestore) return;

        setIsLoading(true);
        const cartRef = collection(firestore, 'users', user.uid, 'cart');
        
        const unsubscribe = onSnapshot(cartRef, (snapshot) => {
            const firestoreItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CartItem));
            setItems(firestoreItems);
            setIsLoading(false);
        }, (error) => {
            console.error("Cart sync error:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, firestore]);

    // 3. Migrate Guest Cart to Firestore on Login
    useEffect(() => {
        if (user && firestore && !isLoading) {
            const guestCart = localStorage.getItem('marigo_cart');
            if (guestCart) {
                try {
                    const localItems: CartItem[] = JSON.parse(guestCart);
                    if (localItems.length > 0) {
                        const batch = writeBatch(firestore);
                        localItems.forEach(item => {
                            const itemRef = doc(firestore, 'users', user.uid, 'cart', item.id);
                            batch.set(itemRef, item, { merge: true });
                        });
                        batch.commit().then(() => {
                            localStorage.removeItem('marigo_cart');
                        });
                    } else {
                        localStorage.removeItem('marigo_cart');
                    }
                } catch (e) {
                    console.error("Migration error:", e);
                }
            }
        }
    }, [user, firestore, isLoading]);

    // 4. Persist Guest Cart to LocalStorage
    useEffect(() => {
        if (!user) {
            localStorage.setItem('marigo_cart', JSON.stringify(items));
        }
    }, [items, user]);

    const subtotal = useMemo(() => items.reduce((acc, item) => acc + (item.price * item.quantity), 0), [items]);

    const applyCoupon = useCallback(async (code: string) => {
        if (!firestore) return { success: false, message: "Service unavailable" };

        try {
            const q = query(collection(firestore, 'coupons'), where('code', '==', code.toUpperCase()), limit(1));
            const snap = await getDocs(q);

            if (snap.empty) return { success: false, message: "That code is not valid." };

            const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as FirestoreCoupon;

            // A first-order coupon needs the buyer's history. Only fetched when
            // one is actually presented, and only as far as the first few
            // orders — we need "any" not "how many".
            let priorOrderCount = 0;
            if (coupon.firstOrderOnly && user) {
                const prior = await getDocs(
                    query(collection(firestore, 'orders'), where('buyerId', '==', user.uid), limit(5)),
                );
                priorOrderCount = prior.docs.filter(d => (d.data() as any)?.status !== 'cancelled').length;
            }

            // Same rules the order routes enforce — this is for instant
            // feedback, not authority. src/lib/coupons.ts.
            const result = validateCoupon(coupon, { subtotal, priorOrderCount });
            if (!result.ok) return { success: false, message: result.message ?? 'That code cannot be used.' };

            setAppliedCoupon(coupon);
            return { success: true, message: "Discount applied." };
        } catch (e) {
            return { success: false, message: "Could not check that code. Try again." };
        }
    }, [firestore, subtotal, user]);

    const removeCoupon = useCallback(() => {
        setAppliedCoupon(null);
    }, []);

    // Same maths the server uses, so the figure shown is the figure charged.
    const discountAmount = useMemo(
        () => (appliedCoupon ? computeDiscount(appliedCoupon, subtotal) : 0),
        [appliedCoupon, subtotal],
    );

    const addToCart = useCallback(async (product: any, options?: { quantity?: number, selectedSize?: string, selectedColor?: string }) => {
        // Block reserved/sold listings — already promised to another buyer.
        if (product?.status === 'reserved' || product?.status === 'sold') {
            toast({
                variant: 'destructive',
                title: 'Item reserved',
                description: 'This listing is already reserved for another buyer.',
            });
            return;
        }
        const requested = options?.quantity || 1;
        const size = options?.selectedSize || product.size || null;
        const color = options?.selectedColor || product.color || null;
        // For variant products, stock is per-size — find the matching variant
        // and use its quantity as the cap. For non-variant listings, fall back
        // to the top-level product quantity.
        const variants = Array.isArray((product as any).variants) ? (product as any).variants : null;
        const matchedVariant = variants && size
            ? variants.find((v: any) => v?.size === size)
            : null;
        const rawStock = matchedVariant
            ? Number(matchedVariant.quantity)
            : (product as any).quantity;
        const stock = typeof rawStock === 'number' && rawStock > 0 ? Math.floor(rawStock) : 1;

        // Each (productId, size) pair is its own cart line.
        const lineId = buildLineId(product.id, size);

        // Find the existing line in the current cart so we can apply stock limits
        // against the combined total (existing + requested).
        let blocked = false;
        let appliedDelta = requested;

        setItems(prev => {
            const existing = prev.find(i => i.id === lineId);
            const currentQty = existing?.quantity ?? 0;
            const cap = stock ?? Number.POSITIVE_INFINITY;
            const nextQty = Math.min(cap, currentQty + requested);
            appliedDelta = nextQty - currentQty;
            if (appliedDelta <= 0) {
                blocked = true;
                return prev;
            }
            const newItem: CartItem = existing
                ? { ...existing, quantity: nextQty, stock: stock ?? existing.stock }
                : {
                    id: lineId,
                    productId: product.id,
                    brand: product.brand || product.brandId || '',
                    title: product.title,
                    price: product.price,
                    // Only a real markdown; `undefined` is stripped by the
                    // JSON round-trip below before it reaches Firestore.
                    originalPrice:
                        typeof product.originalPrice === 'number' && product.originalPrice > product.price
                            ? product.originalPrice
                            : undefined,
                    image: product.images?.[0]?.url || product.image || '',
                    sellerId: product.sellerId,
                    quantity: nextQty,
                    stock,
                    selectedSize: size ?? null,
                    selectedColor: color ?? null,
                    shippingMethod: 'direct',
                    directShippingFee: DEFAULT_SHIPPING_FEE_EUR,
                    shippingFromCity: product.shippingFromCity ?? null,
                    shippingFromCountry: product.shippingFromCountry ?? null,
                };

            // Persist to Firestore (effects-in-render is fine here — same pattern
            // the original code used).
            if (user && firestore) {
                const itemRef = doc(firestore, 'users', user.uid, 'cart', lineId);
                const cleanItem = JSON.parse(JSON.stringify(newItem));
                setDoc(itemRef, cleanItem, { merge: true }).catch(() => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: itemRef.path,
                        operation: 'write',
                        requestResourceData: newItem,
                    }));
                });
            }

            return existing
                ? prev.map(i => i.id === lineId ? newItem : i)
                : [...prev, newItem];
        });

        if (blocked) {
            toast({
                variant: 'destructive',
                title: 'Out of stock',
                description: `Only ${stock} available — already in your cart.`,
            });
            return;
        }

        toast({
            title: 'Added to bag',
            description: `${product.brand || product.brandId || ''} ${product.title} is now in your cart.`,
        });
    }, [user, firestore, toast]);

    const removeFromCart = useCallback(async (itemId: string) => {
        setItems(prev => prev.filter(i => i.id !== itemId));

        if (user && firestore) {
            const itemRef = doc(firestore, 'users', user.uid, 'cart', itemId);
            deleteDoc(itemRef).catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: itemRef.path,
                    operation: 'delete'
                }));
            });
        }
    }, [user, firestore]);

    const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(itemId);
            return;
        }

        let cappedQty = quantity;
        let hitStockCap = false;

        setItems(prev => prev.map(i => {
            if (i.id !== itemId) return i;
            const cap = typeof i.stock === 'number' && i.stock > 0 ? i.stock : Number.POSITIVE_INFINITY;
            cappedQty = Math.min(cap, quantity);
            if (cappedQty < quantity) hitStockCap = true;
            return { ...i, quantity: cappedQty };
        }));

        if (hitStockCap) {
            toast({
                variant: 'destructive',
                title: 'Stock limit reached',
                description: 'You can only buy what the seller has in stock.',
            });
        }

        if (user && firestore) {
            const itemRef = doc(firestore, 'users', user.uid, 'cart', itemId);
            setDoc(itemRef, { quantity: cappedQty }, { merge: true });
        }
    }, [user, firestore, removeFromCart, toast]);

    const clearCart = useCallback(async () => {
        setItems([]);
        setAppliedCoupon(null);
        localStorage.removeItem('marigo_cart');

        if (user && firestore) {
            const cartRef = collection(firestore, 'users', user.uid, 'cart');
            const snapshot = await getDocs(cartRef);
            snapshot.docs.forEach(d => deleteDoc(d.ref));
        }
    }, [user, firestore]);

    const totalItems = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);
    
    // One flat fee per city shipped from — not per item, and not per seller.
    // Two sellers in Tirana share a courier run and one fee; Tirana plus Berat
    // is two runs and two fees. The maths lives in src/lib/shipping.ts so this
    // and calculateOrderTotal() in create-order cannot drift apart.
    const shipping = useMemo(() => {
        const isFree = Boolean(
            settings?.isFreeDeliveryActive && subtotal >= (settings?.freeDeliveryThreshold || 0),
        );
        return calculateShipping(items, { isFree, destinationCountry });
    }, [items, settings, subtotal, destinationCountry]);

    const totalShipping = shipping.totalEur;
    const shippingGroups = shipping.groups;

    const grandTotal = useMemo(() => Math.max(0, subtotal + totalShipping - discountAmount), [subtotal, totalShipping, discountAmount]);

    return (
        <CartContext.Provider value={{ 
            items, 
            addToCart, 
            removeFromCart, 
            updateQuantity, 
            clearCart, 
            applyCoupon,
            removeCoupon,
            appliedCoupon,
            discountAmount,
            subtotal, 
            totalItems, 
            totalShipping,
            shippingGroups, 
            grandTotal, 
            isLoading 
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
};
