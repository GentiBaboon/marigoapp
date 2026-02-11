'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useCart } from '@/context/CartContext';
import { Trash2, ShoppingCart, Minus, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { addDays } from 'date-fns';

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, subtotal, totalItems } = useCart();
  const estimatedDeliveryDate = format(addDays(new Date(), 5), 'dd/MM/yyyy');

  const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
    }).format(value);
  }

  const savings = items.reduce(
    (acc, item) =>
      acc +
      (item.originalPrice ? item.originalPrice - item.price : 0) *
        item.quantity,
    0
  );
  const shipping = 0; // As per image
  const total = subtotal + shipping;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
      {items.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground" />
          <h2 className="mt-6 text-xl font-semibold">Your bag is empty</h2>
          <p className="mt-2 text-muted-foreground">
            Looks like you haven't added anything to your bag yet.
          </p>
          <Button asChild className="mt-6">
            <Link href="/home">Start Shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">{totalItems} Item{totalItems > 1 ? 's' : ''} in the bag</h1>
                    <p className="text-muted-foreground">Estimated delivery: <span className="font-semibold text-foreground">{estimatedDeliveryDate}</span></p>
                </div>
                {items.map((item) => {
                const productImage = PlaceHolderImages.find(
                    (p) => p.id === item.image
                );
                return (
                    <div key={item.id} className="flex gap-4 border rounded-lg p-4 relative">
                        <div className="relative h-40 w-32 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                            {productImage && (
                            <Image
                                src={productImage.imageUrl}
                                alt={item.title}
                                fill
                                className="object-cover"
                                sizes="128px"
                            />
                            )}
                        </div>
                        <div className="flex flex-1 flex-col justify-between py-1">
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">
                                    by {item.brand}
                                </p>
                                <h3 className="font-bold text-lg text-foreground">{item.title}</h3>
                                <div className="flex items-baseline gap-2 mt-1">
                                    {item.originalPrice && (
                                    <p className="text-lg text-muted-foreground line-through">
                                        {currencyFormatter(item.originalPrice)}
                                    </p>
                                    )}
                                    <p className="font-bold text-lg text-destructive">
                                    {currencyFormatter(item.price)}
                                    </p>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {item.selectedColor || 'White'}
                                </p>
                            </div>
                            <div className="flex items-center gap-6 mt-2">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Size</p>
                                    <div className="border rounded-md px-4 py-1.5 text-sm font-medium w-16 text-center">
                                         {item.selectedSize || 'L'}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Qty</p>
                                    <div className="flex items-center border rounded-md">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 text-muted-foreground" onClick={() => removeFromCart(item.id)}>
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                );
                })}
            </div>

            <div className="md:col-span-1">
                <div className="sticky top-24 space-y-6">
                    <Card>
                    <CardContent className="p-4 space-y-4">
                        <div className="flex items-center gap-2">
                            <Input placeholder="Gift Card" />
                            <Button variant="outline">Submit</Button>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span className="font-medium text-foreground">{currencyFormatter(subtotal)}</span>
                            </div>
                            {savings > 0 && (
                                <div className="flex justify-between text-destructive">
                                    <span>Saving</span>
                                    <span className="font-medium">-{currencyFormatter(savings)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-muted-foreground">
                                <span>Shipping</span>
                                <span className="font-medium text-foreground">{currencyFormatter(shipping)}</span>
                            </div>
                        </div>
                    </CardContent>
                    </Card>
                    <Card>
                         <CardContent className="p-4">
                             <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-lg">Total</p>
                                    {savings > 0 && (
                                        <p className="text-muted-foreground line-through">{currencyFormatter(subtotal + shipping)}</p>
                                    )}
                                </div>
                                <p className="font-bold text-2xl">{currencyFormatter(total)}</p>
                            </div>
                         </CardContent>
                    </Card>
                    <Button className="w-full" size="lg" asChild>
                    <Link href="/checkout">Continue to Checkout</Link>
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}