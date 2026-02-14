'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCart, type ShippingMethod } from '@/context/CartContext';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { sellers as mockSellers } from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, Edit, Info, ShieldCheck, Truck, Loader2, ShoppingCart, Lock, RefreshCcw, MessageSquare, CreditCard, Check, Wallet } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { FirestoreAddress } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AddressForm } from '@/components/profile/address-form';
import { Input } from '@/components/ui/input';

const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
};

const PayPalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="h-6 w-auto">
        <path fill="#003087" d="M20.344 6.258c-.297-1.332-1.309-2.22-2.613-2.22H9.27c-.52 0-1.041.34-1.218.846l-3.08 9.539c-.115.356.035.753.39.868l2.969.957c.355.114.753-.035.868-.39l.235-.729a.63.63 0 0 1 .602-.45h.063l4.05-1.236c.356-.115.506-.513.39-.868l-.99-3.06a.63.63 0 0 1 .374-.75l.11-.035c.42-.14.72-.51.68-.96l-.23-1.44c-.03-.2.07-.4.25-.52z"/>
        <path fill="#009cde" d="M21.11 8.358c-.28-1.33-1.25-2.2-2.48-2.2H8.38c-.5 0-1 .32-1.16.8l-1.92 5.95c-.11.34.03.72.37.83l2.84.9c.34.11.72-.04.83-.38l.38-1.16a.6.6 0 0 1 .57-.42h.06l4.2-1.28c.34-.11.48-.5.37-.83l-.94-2.9a.6.6 0 0 1 .35-.7l.11-.04c.4-.13.68-.48.65-.9l-.22-1.38c-.03-.18.06-.38.24-.5z"/>
        <path fill="#012169" d="M12.445 13.118l-3.328 1.018a.63.63 0 0 0-.45.602l.236.729c.115.355.494.558.868.45l2.969-.957a.63.63 0 0 0 .45-.602l-.745-2.24z"/>
    </svg>
)

export default function CheckoutPage() {
    const cart = useCart();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cod');
    
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<FirestoreAddress | null>(null);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/auth');
        }
    }, [user, isUserLoading, router]);

    const addressesCollection = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'addresses');
    }, [user, firestore]);

    const { data: addresses } = useCollection<FirestoreAddress>(addressesCollection);
    const shippingAddress = useMemo(() => addresses?.find(a => a.isDefault) || addresses?.[0], [addresses]);

    const handlePlaceOrder = async () => {
        if (!user || !firestore || !shippingAddress) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Please sign in and select a shipping address.',
            });
            return;
        }

        setIsPlacingOrder(true);

        const orderItems = cart.items.map(item => {
            const imageUrl = PlaceHolderImages.find(p => p.id === item.image)?.imageUrl || item.image;
            return {
                productId: item.id,
                sellerId: item.sellerId,
                title: item.title,
                brand: item.brand,
                image: imageUrl,
                price: item.price,
                quantity: item.quantity,
                size: item.selectedSize || null,
                shippingMethod: 'direct',
                shippingFee: item.directShippingFee,
                authenticationFee: 0,
            };
        });

        const newOrder = {
            orderNumber: `MRG-${Date.now()}`,
            buyerId: user.uid,
            sellerIds: [...new Set(cart.items.map(item => item.sellerId))],
            items: orderItems,
            itemsPrice: cart.subtotal,
            shippingPrice: cart.totalShipping,
            authenticationPrice: cart.totalAuthentication,
            totalAmount: cart.grandTotal,
            paymentStatus: 'pending',
            paymentMethod: selectedPaymentMethod,
            status: 'processing',
            shippingAddress,
            createdAt: serverTimestamp(),
        };

        try {
            await addDoc(collection(firestore, 'orders'), newOrder);
            toast({
                title: 'Order Placed!',
                description: 'Thank you for your purchase.',
                variant: 'success',
            });
            cart.clearCart();
            router.push('/profile/orders');
        } catch (error) {
            console.error("Error placing order:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'orders',
                operation: 'create',
                requestResourceData: newOrder,
            }));
            toast({
                variant: 'destructive',
                title: 'Uh oh! Something went wrong.',
                description: 'Could not place your order. Please try again.',
            });
        } finally {
            setIsPlacingOrder(false);
        }
    };
    
    const handleChangeAddress = () => {
        setEditingAddress(shippingAddress || null);
        setIsAddressModalOpen(true);
    }
    
    const handleAddAddress = () => {
        setEditingAddress(null);
        setIsAddressModalOpen(true);
    }

    if (isUserLoading || !user) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="dot-flashing"></div>
            </div>
        );
    }

    if (cart.items.length === 0 && !isPlacingOrder) {
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
        <div className="container mx-auto max-w-2xl px-4 py-8 md:py-12">
            <div className="space-y-6">
                
                {step === 1 ? (
                    <section>
                        <h1 className="text-2xl font-bold mb-4">1. Bag</h1>
                        {cart.sellers.map(({ sellerId, items }) => {
                            const seller = mockSellers.find(s => s.id === sellerId);
                            return (
                                <Card key={sellerId} className="mb-6 overflow-hidden">
                                    <CardHeader className="flex-row items-center justify-between bg-muted/50 p-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={seller?.avatar} alt={seller?.username}/>
                                                <AvatarFallback>{seller?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-semibold">{seller?.username}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-muted-foreground">More info <ChevronDown className="h-4 w-4 ml-1"/></Button>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-4">
                                        {items.map((item, index) => {
                                            const productImage = PlaceHolderImages.find(p => p.id === item.image);
                                            return (
                                                <React.Fragment key={item.id}>
                                                    <div className="flex gap-4">
                                                        <div className="relative h-28 w-24 flex-shrink-0">
                                                            {productImage && <Image src={productImage.imageUrl} alt={item.title} fill className="object-cover rounded-md" sizes="96px" />}
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex justify-between">
                                                                <p className="font-bold uppercase text-sm">{item.brand}</p>
                                                                <p className="font-bold">{currencyFormatter(item.price)}</p>
                                                            </div>
                                                            <p>{item.title}</p>
                                                            <p className="text-sm text-muted-foreground">Size: {item.selectedSize || 'M'}</p>
                                                        </div>
                                                    </div>
                                                    <RadioGroup value="direct">
                                                        <Label className="flex items-start gap-4 rounded-md border p-3 border-foreground">
                                                            <RadioGroupItem value="direct" id={`direct-${item.id}`}/>
                                                            <div className="w-full">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="font-semibold flex items-center gap-2"><Truck className="h-5 w-5"/>Direct Shipping</p>
                                                                    <p className="font-semibold">{currencyFormatter(item.directShippingFee)}</p>
                                                                </div>
                                                                <p className="text-sm text-muted-foreground ml-7">Shipping fee</p>
                                                            </div>
                                                        </Label>
                                                    </RadioGroup>
                                                    <Button variant="link" className="text-muted-foreground h-auto p-0 text-sm" onClick={() => cart.removeFromCart(item.id)}>Delete item</Button>
                                                    {index < items.length - 1 && <Separator />}
                                                </React.Fragment>
                                            )
                                        })}
                                    </CardContent>
                                </Card>
                            )
                        })}
                        <Button className="w-full" variant="outline" size="lg" onClick={() => setStep(2)}>Confirm step</Button>
                    </section>
                ) : (
                     <Card>
                        <CardHeader className="flex-row items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">1. Bag</h2>
                            <Button variant="ghost" onClick={() => setStep(1)}><Edit className="mr-2 h-4 w-4" />Edit</Button>
                        </CardHeader>
                        <CardContent className="space-y-1 p-4">
                            {cart.items.map(item => (
                                <p key={item.id} className="text-muted-foreground text-sm">{item.brand}, {item.title}, {item.selectedSize || 'Size M'}</p>
                            ))}
                            <p className="flex items-center gap-1 text-sm pt-2"><ShieldCheck className="h-4 w-4 text-green-600" /> Authentication & quality control included</p>
                        </CardContent>
                    </Card>
                )}

                {step > 1 && (
                    <div className="space-y-6">
                        {step === 2 ? (
                            <Card>
                                <CardHeader className="p-4 border-b">
                                    <h2 className="text-lg font-semibold flex items-center gap-2">2. Shipping <Info className="h-4 w-4 text-muted-foreground" /></h2>
                                </CardHeader>
                                <CardContent className="space-y-6 p-4">
                                    <RadioGroup defaultValue="homedelivery" className="space-y-4">
                                        <div className="border rounded-md has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary">
                                            <Label className="flex items-start gap-4 p-4 cursor-pointer">
                                                <RadioGroupItem value="homedelivery" id="homedelivery" className="mt-1"/>
                                                <div className="w-full">
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-semibold">Home delivery</p>
                                                        <p className="font-semibold">{currencyFormatter(cart.totalShipping)}</p>
                                                    </div>
                                                </div>
                                            </Label>
                                            
                                            {shippingAddress ? (
                                                <>
                                                    <Separator />
                                                    <div className="p-4 ml-9 text-sm space-y-1">
                                                        <p className="font-semibold">{shippingAddress.fullName}</p>
                                                        <p className="text-muted-foreground">{shippingAddress.address}</p>
                                                        <p className="text-muted-foreground">{shippingAddress.city}, {shippingAddress.postal}</p>
                                                        <p className="text-muted-foreground">{shippingAddress.country}</p>
                                                        <div className="mt-3">
                                                            <Button variant="link" className="p-0 h-auto underline text-xs" onClick={handleChangeAddress}>Change Address</Button>
                                                            <span className="mx-2 text-muted-foreground">|</span>
                                                            <Button variant="link" className="p-0 h-auto underline text-xs" onClick={handleAddAddress}>Add a new address</Button>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                 <div className="p-4 ml-9">
                                                    <Button onClick={handleAddAddress}>Add shipping address</Button>
                                                 </div>
                                            )}
                                        </div>
                                    </RadioGroup>

                                    <div className="flex items-center space-x-2">
                                      <Checkbox id="billing-address" defaultChecked />
                                      <Label htmlFor="billing-address" className="text-sm font-medium leading-none">
                                        Billing address matches shipping address
                                      </Label>
                                    </div>

                                    <Button className="w-full" variant="outline" size="lg" onClick={() => setStep(3)} disabled={!shippingAddress}>Confirm step</Button>
                                </CardContent>
                            </Card>
                         ) : (
                            <Card>
                                <CardHeader className="flex-row items-center justify-between p-4 border-b">
                                   <h2 className="text-lg font-semibold">2. Shipping</h2>
                                    <Button variant="ghost" onClick={() => setStep(2)}><Edit className="mr-2 h-4 w-4" />Edit</Button>
                                </CardHeader>
                                <CardContent className="p-4">
                                   <p className="font-medium text-sm">{shippingAddress?.fullName}</p>
                                   <p className="text-muted-foreground text-sm">{shippingAddress?.address}, {shippingAddress?.city}</p>
                                </CardContent>
                            </Card>
                         )}

                        {step === 3 && (
                             <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <h2 className="text-lg font-semibold">3. Payment</h2>
                                    </CardHeader>
                                    <CardContent>
                                        <RadioGroup value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod} className="space-y-3">
                                            <Label className="flex items-center gap-4 rounded-md border p-3 cursor-pointer has-[:checked]:border-foreground">
                                                <RadioGroupItem value="cod" id="cod" />
                                                <p className="font-semibold flex-1">Cash on Delivery</p>
                                                <Wallet className="h-6 w-6 text-muted-foreground" />
                                            </Label>
                                            <Label className="flex items-center gap-4 rounded-md border p-3 cursor-pointer has-[:checked]:border-foreground">
                                                <RadioGroupItem value="credit_card" id="credit_card" />
                                                <p className="font-semibold flex-1">Credit Card</p>
                                                <div className="flex items-center gap-1">
                                                    <div className="w-8 h-5 bg-[#1a1f71] rounded-sm text-white flex items-center justify-center text-xs font-bold">VISA</div>
                                                    <div className="w-8 h-5 bg-black rounded-sm text-white flex items-center justify-center">
                                                        <div className="h-3.5 w-3.5 rounded-full bg-red-600 opacity-90"></div>
                                                        <div className="h-3.5 w-3.5 rounded-full bg-yellow-500 opacity-90 -ml-2"></div>
                                                    </div>
                                                    <div className="border rounded-sm w-8 h-5 text-muted-foreground text-xs flex items-center justify-center">+4</div>
                                                </div>
                                            </Label>
                                            <Label className="flex items-center gap-4 rounded-md border p-3 cursor-pointer has-[:checked]:border-foreground">
                                                <RadioGroupItem value="paypal" id="paypal" />
                                                <p className="font-semibold flex-1">PayPal</p>
                                                <PayPalIcon />
                                            </Label>
                                        </RadioGroup>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Order Summary</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <Accordion type="single" collapsible>
                                            <AccordionItem value="item-1" className="border-b-0">
                                                <AccordionTrigger className="font-medium">Price details ({cart.totalItems} items)</AccordionTrigger>
                                                <AccordionContent className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <p className="text-muted-foreground">Products price</p>
                                                        <p>{currencyFormatter(cart.subtotal)}</p>
                                                    </div>
                                                     <div className="flex justify-between">
                                                        <p className="text-muted-foreground">Authentication</p>
                                                        <p>{currencyFormatter(cart.totalAuthentication)}</p>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                        <div className="flex justify-between font-medium">
                                            <p>Promo code <span className="text-muted-foreground">(optional)</span></p>
                                            <Input className="max-w-xs" placeholder="Enter promo code" />
                                        </div>
                                         <Accordion type="single" collapsible defaultValue="item-1">
                                            <AccordionItem value="item-1" className="border-b-0">
                                                <AccordionTrigger className="font-medium">Shipping</AccordionTrigger>
                                                <AccordionContent>
                                                    <p className="text-muted-foreground">{currencyFormatter(cart.totalShipping)}</p>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                        <Separator />
                                         <div className="flex justify-between text-lg font-bold">
                                            <p>Total including fees & taxes</p>
                                            <p>{currencyFormatter(cart.grandTotal)}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Button className="w-full bg-foreground text-background hover:bg-foreground/90" size="lg" disabled={isPlacingOrder} onClick={handlePlaceOrder}>
                                    {isPlacingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Place order
                                </Button>
                                <p className="text-xs text-center text-muted-foreground">Total includes buyer service fee and currency conversion fee (if applicable). By placing your order, you agree to our <Link href="#" className="underline">Buyer Terms & Conditions</Link>.</p>
                                
                                <div className="space-y-4 pt-4">
                                    <div className="flex items-start gap-4">
                                        <Lock className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                                        <div>
                                            <p className="font-semibold">Guaranteed delivery</p>
                                            <p className="text-sm text-muted-foreground">It ships safely, or your money back</p>
                                        </div>
                                    </div>
                                     <div className="flex items-start gap-4">
                                        <RefreshCcw className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                                        <div>
                                            <p className="font-semibold">Free relist</p>
                                            <p className="text-sm text-muted-foreground">Instantly relist within 72h of delivery</p>
                                        </div>
                                    </div>
                                     <div className="flex items-start gap-4">
                                        <MessageSquare className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                                        <div>
                                            <p className="font-semibold">Customer support</p>
                                            <p className="text-sm text-muted-foreground">Chat or email, we're here for you</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                         )}
                    </div>
                )}
            </div>

            <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
                <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                </DialogHeader>
                {user && (
                    <AddressForm
                    userId={user.uid}
                    addressToEdit={editingAddress}
                    onSave={() => setIsAddressModalOpen(false)}
                    />
                )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
