
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { doc, setDoc, deleteDoc, collection, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';

export type ShippingMethod = 'direct' | 'authentication';

export type CartItem = {
    id: string;
    brand: string;
    title: string;
    price: number;
    image: string;
    sellerId: string;
    quantity: number;
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
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

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

    const addToCart = useCallback(async (product: any, options?: { quantity?: number, selectedSize?: string, selectedColor?: string }) => {
        const quantity = options?.quantity || 1;
        const size = options?.selectedSize || product.size || null;
        const color = options?.selectedColor || product.color || null;

        const newItem: CartItem = {
            id: product.id,
            brand: product.brand,
            title: product.title,
            price: product.price,
            image: product.images?.[0] || product.image,
            sellerId: product.sellerId,
            quantity,
            selectedSize: size,
            selectedColor: color,
            shippingMethod: 'direct',
            directShippingFee: 10.90,
        };

        // Optimistic update for UI feel
        setItems(prev => {
            const existing = prev.find(i => i.id === newItem.id);
            if (existing) {
                return prev.map(i => i.id === newItem.id ? { ...i, quantity: i.quantity + quantity } : i);
            }
            return [...prev, newItem];
        });

        if (user && firestore) {
            const itemRef = doc(firestore, 'users', user.uid, 'cart', product.id);
            setDoc(itemRef, newItem, { merge: true }).catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: itemRef.path,
                    operation: 'write',
                    requestResourceData: newItem
                }));
            });
        }

        toast({
            title: "Added to bag",
            description: `${newItem.brand} ${newItem.title} is now in your cart.`,
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

        setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity } : i));

        if (user && firestore) {
            const itemRef = doc(firestore, 'users', user.uid, 'cart', itemId);
            setDoc(itemRef, { quantity }, { merge: true });
        }
    }, [user, firestore, removeFromCart]);

    const clearCart = useCallback(async () => {
        setItems([]);
        localStorage.removeItem('marigo_cart');

        if (user && firestore) {
            const cartRef = collection(firestore, 'users', user.uid, 'cart');
            const snapshot = await getDocs(cartRef);
            snapshot.docs.forEach(d => deleteDoc(d.ref));
        }
    }, [user, firestore]);

    const subtotal = useMemo(() => items.reduce((acc, item) => acc + (item.price * item.quantity), 0), [items]);
    const totalItems = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);
    const totalShipping = useMemo(() => items.reduce((acc, item) => acc + (item.directShippingFee * item.quantity), 0), [items]);
    const grandTotal = useMemo(() => subtotal + totalShipping, [subtotal, totalShipping]);

    return (
        <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, subtotal, totalItems, totalShipping, grandTotal, isLoading }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
};
