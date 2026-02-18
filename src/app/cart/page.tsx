'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useCart } from '@/context/CartContext';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
};

export default function CartPage() {
    const { 
        items, 
        removeFromCart, 
        subtotal, 
        totalShipping,
        grandTotal
    } = useCart();
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    
    React.useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/auth');
        }
    }, [user, isUserLoading, router]);

    if (isUserLoading || !user) {
        return (
            <div className="flex h-[calc(100vh-8rem)] w-screen items-center justify-center bg-background">
                <div className="dot-flashing"></div>
            </div>
        );
    }
    
    if (items.length === 0) {
        return (
            <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
                <div className="text-center py-20">
                    <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground" />
                    <h2 className="mt-6 text-xl font-semibold">Your bag is empty</h2>
                    <p className="mt-2 text-muted-foreground">Looks like you haven't added anything yet.</p>
                    <Button asChild className="mt-6">
                        <Link href="/home">Start Shopping</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-2xl px-4 py-8 md:py-12 pb-32">
            <h1 className="text-3xl font-bold mb-6">In the Bag</h1>

            <div className="space-y-6">
                {items.map((item, index) => {
                    return (
                        <React.Fragment key={item.id}>
                            <Card className="overflow-hidden">
                                <CardContent className="p-4 flex gap-4">
                                    <div className="relative h-32 w-28 flex-shrink-0">
                                        {item.image && <Image src={item.image} alt={item.title} fill className="object-cover rounded-md" sizes="112px" />}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between">
                                            <p className="font-bold uppercase text-sm">{item.brand}</p>
                                            <p className="font-bold">{currencyFormatter(item.price)}</p>
                                        </div>
                                        <p>{item.title}</p>
                                        <p className="text-sm text-muted-foreground">Size: {item.selectedSize || 'M'}</p>
                                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                                         <Button variant="link" className="text-destructive h-auto p-0 text-sm font-normal" onClick={() => removeFromCart(item.id)}>
                                            <Trash2 className="h-3.5 w-3.5 mr-1"/>
                                            Remove
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </React.Fragment>
                    )
                })}

                <Card>
                    <CardContent className="p-4 space-y-4">
                        <div className="flex items-center gap-2">
                            <Input placeholder="Add a gift card or voucher" />
                            <Button variant="outline">Add</Button>
                        </div>
                        <Separator />
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <p className="text-muted-foreground">Subtotal</p>
                                <p>{currencyFormatter(subtotal)}</p>
                            </div>
                             <div className="flex justify-between">
                                <p className="text-muted-foreground">Savings</p>
                                <p className="text-green-600">- {currencyFormatter(0)}</p>
                            </div>
                             <div className="flex justify-between">
                                <p className="text-muted-foreground">Shipping</p>
                                <p>{currencyFormatter(totalShipping)}</p>
                            </div>
                        </div>
                        <Separator />
                         <div className="flex justify-between font-bold">
                            <p>Total</p>
                            <p>{currencyFormatter(grandTotal)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="fixed bottom-16 md:bottom-0 left-0 w-full bg-background/95 backdrop-blur-sm border-t p-4 z-40">
                <div className="container max-w-2xl mx-auto px-0">
                    <Button asChild size="lg" className="w-full">
                        <Link href="/checkout">Continue to checkout</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
