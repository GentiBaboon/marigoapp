'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { doc, setDoc, deleteDoc, collection, getDocs, onSnapshot, writeBatch, query, where, limit } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import type { FirestoreCoupon, FirestoreSettings } from '@/lib/types';

export type ShippingMethod = 'direct' | 'authentication';

export type CartItem = {
    id: string;
    brand: string;
    title: string;
    price: number;
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
};

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
            
            if (snap.empty) return { success: false, message: "Invalid coupon code" };
            
            const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as FirestoreCoupon;
            
            if (!coupon.isActive) return { success: false, message: "This coupon is no longer active" };
            if (subtotal < (coupon.minOrderValue || 0)) {
                return { success: false, message: `Minimum spend of €${coupon.minOrderValue} required` };
            }

            setAppliedCoupon(coupon);
            return { success: true, message: "Coupon applied!" };
        } catch (e) {
            return { success: false, message: "Error validating coupon" };
        }
    }, [firestore, subtotal]);

    const removeCoupon = useCallback(() => {
        setAppliedCoupon(null);
    }, []);

    const discountAmount = useMemo(() => {
        if (!appliedCoupon) return 0;
        if (appliedCoupon.type === 'percentage') {
            return (subtotal * appliedCoupon.value) / 100;
        }
        return appliedCoupon.value;
    }, [appliedCoupon, subtotal]);

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
        // Stock — pulled from the product record. Default to 1 for legacy
        // listings without the field: most resale items are unique pieces, so
        // unlimited would let buyers oversell.
        const rawStock = (product as any).quantity;
        const stock = typeof rawStock === 'number' && rawStock > 0 ? Math.floor(rawStock) : 1;

        // Find the existing line in the current cart so we can apply stock limits
        // against the combined total (existing + requested).
        let blocked = false;
        let appliedDelta = requested;

        setItems(prev => {
            const existing = prev.find(i => i.id === product.id);
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
                    id: product.id,
                    brand: product.brand || product.brandId || '',
                    title: product.title,
                    price: product.price,
                    image: product.images?.[0]?.url || product.image || '',
                    sellerId: product.sellerId,
                    quantity: nextQty,
                    stock,
                    selectedSize: size ?? null,
                    selectedColor: color ?? null,
                    shippingMethod: 'direct',
                    directShippingFee: 10.90,
                };

            // Persist to Firestore (effects-in-render is fine here — same pattern
            // the original code used).
            if (user && firestore) {
                const itemRef = doc(firestore, 'users', user.uid, 'cart', product.id);
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
                ? prev.map(i => i.id === product.id ? newItem : i)
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
    
    const totalShipping = useMemo(() => {
        if (settings?.isFreeDeliveryActive && subtotal >= (settings?.freeDeliveryThreshold || 0)) {
            return 0;
        }
        return items.reduce((acc, item) => acc + (item.directShippingFee * item.quantity), 0);
    }, [items, settings, subtotal]);

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
