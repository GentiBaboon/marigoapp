'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import type { Product } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';

export type ShippingMethod = 'direct' | 'authentication';

export type CartItem = Product & {
    quantity: number;
    selectedSize?: string;
    selectedColor?: string;
    shippingMethod: ShippingMethod;
    authenticationFee: number;
    directShippingFee: number;
    authShippingFee: number;
};

interface CartContextType {
    items: CartItem[];
    addToCart: (product: Product, options?: { quantity?: number, selectedSize?: string, selectedColor?: string }) => void;
    removeFromCart: (itemId: string) => void;
    updateQuantity: (itemId: string, quantity: number) => void;
    updateShippingMethod: (itemId: string, method: ShippingMethod) => void;
    clearCart: () => void;
    subtotal: number;
    totalItems: number;
    totalShipping: number;
    totalAuthentication: number;
    grandTotal: number;
    sellers: { sellerId: string, items: CartItem[] }[];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        const savedCart = localStorage.getItem('marigo_cart');
        if (savedCart) {
            setItems(JSON.parse(savedCart));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('marigo_cart', JSON.stringify(items));
    }, [items]);

    const addToCart = useCallback((product: Product, options?: { quantity?: number, selectedSize?: string, selectedColor?: string }) => {
        setItems(prevItems => {
            const existingItem = prevItems.find(item => item.id === product.id);
            const quantity = options?.quantity || 1;

            if (existingItem) {
                return prevItems.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            } else {
                 const newItem: CartItem = {
                    ...product,
                    quantity,
                    ...options,
                    shippingMethod: product.price >= 1000 ? 'authentication' : 'direct', // Default based on price
                    authenticationFee: product.price < 1000 ? 15 : 0, // 15 for items < 1000, 0 (included) otherwise
                    directShippingFee: 10.90, // Example fee
                    authShippingFee: product.price < 1000 ? 10.90 : 20, // Example fee
                };
                return [...prevItems, newItem];
            }
        });
        toast({
            title: "Added to Cart",
            description: `${product.title} has been added to your shopping bag.`,
        });
    }, [toast]);

    const removeFromCart = useCallback((itemId: string) => {
        setItems(prevItems => prevItems.filter(item => item.id !== itemId));
    }, []);

    const updateQuantity = useCallback((itemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(itemId);
        } else {
            setItems(prevItems =>
                prevItems.map(item =>
                    item.id === itemId ? { ...item, quantity } : item
                )
            );
        }
    }, [removeFromCart]);
    
    const updateShippingMethod = useCallback((itemId: string, method: ShippingMethod) => {
        setItems(prevItems =>
            prevItems.map(item =>
                item.id === itemId ? { ...item, shippingMethod: method } : item
            )
        );
    }, []);

    const clearCart = useCallback(() => {
        setItems([]);
    }, []);

    const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.price * item.quantity, 0), [items]);
    const totalItems = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);
    
    const totalShipping = useMemo(() => items.reduce((acc, item) => {
        const fee = item.shippingMethod === 'direct' ? item.directShippingFee : item.authShippingFee;
        return acc + fee;
    }, 0), [items]);

    const totalAuthentication = useMemo(() => items.reduce((acc, item) => {
        const fee = item.shippingMethod === 'authentication' ? item.authenticationFee : 0;
        return acc + fee;
    }, 0), [items]);

    const grandTotal = useMemo(() => subtotal + totalShipping + totalAuthentication, [subtotal, totalShipping, totalAuthentication]);

    const sellers = useMemo(() => {
        const groups: { [key: string]: CartItem[] } = {};
        for (const item of items) {
            if (!groups[item.sellerId]) {
                groups[item.sellerId] = [];
            }
            groups[item.sellerId].push(item);
        }
        return Object.entries(groups).map(([sellerId, items]) => ({ sellerId, items }));
    }, [items]);


    return (
        <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, updateShippingMethod, clearCart, subtotal, totalItems, totalShipping, totalAuthentication, grandTotal, sellers }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};
