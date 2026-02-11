'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCart, type ShippingMethod } from '@/context/CartContext';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { sellers as mockSellers } from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, Edit, Info, ShieldCheck, Truck, Loader2, ShoppingCart } from 'lucide-react';
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

const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
};

export default function CheckoutPage() {
    const cart = useCart();
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<FirestoreAddress | null>(null);

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
                shippingMethod: item.shippingMethod,
                shippingFee: item.shippingMethod === 'direct' ? item.directShippingFee : item.authShippingFee,
                authenticationFee: item.shippingMethod === 'authentication' ? item.authenticationFee : 0,
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
            paymentMethod: 'credit_card', // Placeholder
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
                                            const hasDirectShipping = item.price < 1000;
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
                                                    <RadioGroup value={item.shippingMethod} onValueChange={(val) => cart.updateShippingMethod(item.id, val as ShippingMethod)}>
                                                        {hasDirectShipping && (
                                                            <Label className="flex items-start gap-4 rounded-md border p-3 cursor-pointer has-[:checked]:border-foreground">
                                                                <RadioGroupItem value="direct" id={`direct-${item.id}`}/>
                                                                <div className="w-full">
                                                                    <div className="flex items-center justify-between">
                                                                        <p className="font-semibold flex items-center gap-2"><Truck className="h-5 w-5"/>Direct Shipping</p>
                                                                        <p className="font-semibold">{currencyFormatter(item.directShippingFee)}</p>
                                                                    </div>
                                                                    <p className="text-sm text-muted-foreground ml-7">Shipping fee</p>
                                                                </div>
                                                            </Label>
                                                        )}
                                                         <Label className="flex items-start gap-4 rounded-md border p-3 cursor-pointer has-[:checked]:border-foreground">
                                                            <RadioGroupItem value="authentication" id={`auth-${item.id}`}/>
                                                            <div className="w-full">
                                                                <p className="font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Authentication & quality control</p>
                                                                <div className="flex items-center justify-between ml-7">
                                                                    <p className="text-sm text-muted-foreground">Authentication & quality control</p>
                                                                    <p className="text-sm font-semibold">{item.authenticationFee > 0 ? currencyFormatter(item.authenticationFee) : 'Included'}</p>
                                                                </div>
                                                                <div className="flex items-center justify-between ml-7">
                                                                    <p className="text-sm text-muted-foreground">Shipping fee</p>
                                                                    <p className="text-sm font-semibold">{currencyFormatter(item.authShippingFee)}</p>
                                                                </div>
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

                        <div className={cn(step < 3 && "hidden")}>
                            {/* Payment and Final summary would go here */}
                             <Button className="w-full bg-foreground text-background hover:bg-foreground/90" size="lg" disabled={isPlacingOrder} onClick={handlePlaceOrder}>
                                {isPlacingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Place order
                            </Button>
                        </div>
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
    