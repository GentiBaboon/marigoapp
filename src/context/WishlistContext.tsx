
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

type WishlistItem = { id: string; addedAt: any };

interface WishlistContextType {
    wishlistItems: WishlistItem[];
    isLoading: boolean;
    addToWishlist: (productId: string) => void;
    removeFromWishlist: (productId: string) => void;
    isFavorite: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const wishlistCollection = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'wishlist');
    }, [user, firestore]);

    const { data: rawWishlistItems, isLoading: isWishlistLoading } = useCollection<{ addedAt: any }>(wishlistCollection);

    const wishlistItems = useMemo(() => rawWishlistItems || [], [rawWishlistItems]);
    const favoriteIds = useMemo(() => new Set(wishlistItems.map(item => item.id)), [wishlistItems]);

    const handleAuthRedirect = useCallback(() => {
        router.push('/auth');
    }, [router]);

    const addToWishlist = useCallback(async (productId: string) => {
        if (isUserLoading) return; // Prevent action while auth state is resolving
        if (!user || !firestore) {
            handleAuthRedirect();
            return;
        }
        try {
            const wishlistItemRef = doc(firestore, 'users', user.uid, 'wishlist', productId);
            await setDoc(wishlistItemRef, { addedAt: serverTimestamp() });
            toast({
                title: 'Added to favorites!',
            });
        } catch (error) {
            console.error("Error adding to wishlist: ", error);
            const permissionError = new FirestorePermissionError({
              path: `users/${user.uid}/wishlist/${productId}`,
              operation: 'write',
              requestResourceData: { addedAt: 'SERVER_TIMESTAMP' }
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not add to favorites.',
            });
        }
    }, [user, isUserLoading, firestore, handleAuthRedirect, toast]);

    const removeFromWishlist = useCallback(async (productId: string) => {
        if (isUserLoading) return; // Prevent action while auth state is resolving
        if (!user || !firestore) {
            handleAuthRedirect();
            return;
        }
        try {
            const wishlistItemRef = doc(firestore, 'users', user.uid, 'wishlist', productId);
            await deleteDoc(wishlistItemRef);
            toast({
                title: 'Removed from favorites.',
            });
        } catch (error) {
            console.error("Error removing from wishlist: ", error);
            const permissionError = new FirestorePermissionError({
              path: `users/${user.uid}/wishlist/${productId}`,
              operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not remove from favorites.',
            });
        }
    }, [user, isUserLoading, firestore, handleAuthRedirect, toast]);

    const isFavorite = useCallback((productId: string) => {
        return favoriteIds.has(productId);
    }, [favoriteIds]);

    const isLoading = isUserLoading || isWishlistLoading;

    return (
        <WishlistContext.Provider value={{ wishlistItems, isLoading, addToWishlist, removeFromWishlist, isFavorite }}>
            {children}
        </WishlistContext.Provider>
    );
};

export const useWishlist = () => {
    const context = useContext(WishlistContext);
    if (context === undefined) {
        throw new Error('useWishlist must be used within a WishlistProvider');
    }
    return context;
};
