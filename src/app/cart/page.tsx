'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, Trash2, Heart, ArrowRight, Loader2, Tag, X } from 'lucide-react';
import { useCurrency } from '@/context/CurrencyContext';
import { useWishlist } from '@/context/WishlistContext';
import { useToast } from '@/hooks/use-toast';

export default function CartPage() {
    const { items, removeFromCart, updateQuantity, subtotal, totalShipping, grandTotal, appliedCoupon, discountAmount, applyCoupon, removeCoupon, isLoading } = useCart();
    const { formatPrice } = useCurrency();
    const { addToWishlist } = useWishlist();
    const { toast } = useToast();
    const [couponCode, setCouponCode] = useState('');
    const [isApplying, setIsApplying] = useState(false);

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="container mx-auto max-w-4xl px-4 py-20 text-center">
                <div className="bg-muted/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground" />
                </div>
                <h1 className="text-3xl font-bold font-headline mb-2">Your bag is empty</h1>
                <p className="text-muted-foreground mb-8">Looks like you haven't added anything yet. Discover our latest arrivals!</p>
                <Button asChild size="lg" className="rounded-full px-8">
                    <Link href="/home">Start Shopping</Link>
                </Button>
            </div>
        );
    }

    const handleMoveToWishlist = (item: any) => {
        addToWishlist(item.id);
        removeFromCart(item.id);
    };

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;
        setIsApplying(true);
        const result = await applyCoupon(couponCode);
        if (result.success) {
            toast({ title: result.message });
            setCouponCode('');
        } else {
            toast({ variant: 'destructive', title: result.message });
        }
        setIsApplying(false);
    };

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8 md:py-12">
            {(() => {
              const totalItems = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
              return (
                <h1 className="text-3xl font-bold font-headline mb-8 flex items-center gap-3">
                    Shopping Bag
                    <span className="text-lg font-sans font-normal text-muted-foreground">
                        ({totalItems} {totalItems === 1 ? 'item' : 'items'})
                    </span>
                </h1>
              );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-6">
                    {items.map((item) => (
                        <Card key={item.id} className="overflow-hidden border-none shadow-sm bg-muted/20">
                            <CardContent className="p-4 sm:p-6">
                                <div className="flex gap-4 sm:gap-6">
                                    <Link href={`/products/${item.id}`} className="relative h-32 w-24 sm:h-40 sm:w-32 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                                        <Image
                                            src={item.image}
                                            alt={item.title}
                                            fill
                                            className="object-cover"
                                            sizes="128px"
                                        />
                                    </Link>
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-xs uppercase tracking-widest text-primary">{item.brand}</p>
                                                    <h3 className="font-medium text-lg leading-tight">{item.title}</h3>
                                                </div>
                                                <p className="font-bold text-lg">{formatPrice(item.price)}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
                                                {item.selectedSize && <span>Size: <span className="text-foreground font-medium">{item.selectedSize}</span></span>}
                                                {item.selectedColor && <span>Color: <span className="text-foreground font-medium">{item.selectedColor}</span></span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-4">
                                            {(() => {
                                              const atMax = typeof item.stock === 'number' && item.quantity >= item.stock;
                                              return (
                                                <div className="flex items-center gap-3">
                                                  <div className="flex items-center border rounded-full bg-background px-2">
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8 rounded-full"
                                                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                    >-</Button>
                                                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8 rounded-full"
                                                      disabled={atMax}
                                                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                    >+</Button>
                                                  </div>
                                                  {atMax && (
                                                    <span className="text-xs text-muted-foreground">
                                                      Max stock: {item.stock}
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })()}
                                            <div className="flex gap-4">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="text-muted-foreground hover:text-primary h-auto p-0"
                                                    onClick={() => handleMoveToWishlist(item)}
                                                >
                                                    <Heart className="h-4 w-4 mr-1.5" />
                                                    <span className="hidden sm:inline">Wishlist</span>
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="text-muted-foreground hover:text-destructive h-auto p-0"
                                                    onClick={() => removeFromCart(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                                    <span className="hidden sm:inline">Remove</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="lg:col-span-1">
                    <Card className="sticky top-24 border-2 border-primary/10">
                        <CardContent className="p-6 space-y-6">
                            <h2 className="text-xl font-bold font-headline">Order Summary</h2>
                            
                            <div className="space-y-4">
                                {appliedCoupon ? (
                                    <div className="flex items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/20">
                                        <div className="flex items-center gap-2">
                                            <Tag className="h-4 w-4 text-primary" />
                                            <span className="font-bold text-sm uppercase">{appliedCoupon.code}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={removeCoupon}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            placeholder="Promo code" 
                                            className="rounded-full" 
                                            value={couponCode} 
                                            onChange={(e) => setCouponCode(e.target.value)} 
                                        />
                                        <Button 
                                            variant="outline" 
                                            className="rounded-full px-6" 
                                            onClick={handleApplyCoupon}
                                            disabled={isApplying || !couponCode.trim()}
                                        >
                                            {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                                        </Button>
                                    </div>
                                )}
                                <Separator />
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-medium">{formatPrice(subtotal)}</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between text-green-600 font-medium">
                                            <span>Discount</span>
                                            <span>-{formatPrice(discountAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Shipping (Direct)</span>
                                        <span className="font-medium">
                                            {totalShipping === 0 ? (
                                                <span className="text-green-600 font-bold uppercase tracking-tight">Free</span>
                                            ) : formatPrice(totalShipping)}
                                        </span>
                                    </div>
                                </div>
                                <Separator />
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-lg font-bold">Total</span>
                                    <span className="text-2xl font-bold text-primary">{formatPrice(grandTotal)}</span>
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button asChild size="lg" className="w-full rounded-full h-14 text-base font-bold shadow-lg shadow-primary/20">
                                    <Link href="/checkout">
                                        Checkout Now
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Link>
                                </Button>
                            </div>

                            <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                                Prices inclusive of VAT. By proceeding to checkout, you agree to our <Link href="/terms" className="underline">Terms of Service</Link>. Your payment is protected by our secure escrow system.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
