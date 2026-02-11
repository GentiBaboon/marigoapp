'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cartItems } from '@/lib/mock-data';
import type { CartProduct } from '@/lib/mock-data';
import { Trash2, ShoppingCart } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function CartPage() {
  // In a real app, this would come from a state management solution
  const items: CartProduct[] = cartItems;

  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  const subtotal = items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const savings = items.reduce(
    (acc, item) =>
      acc +
      (item.originalPrice ? item.originalPrice - item.price : 0) *
        item.quantity,
    0
  );
  const shipping = 15; // Example shipping cost
  const total = subtotal + shipping;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-center">
          Shopping Bag
        </h1>
      </div>

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
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-12">
          <div className="lg:col-span-2 space-y-6">
            {items.map((item) => {
              const productImage = PlaceHolderImages.find(
                (p) => p.id === item.image
              );
              return (
                <div key={item.id} className="flex gap-4">
                  <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-md border">
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
                        {item.brand}
                      </p>
                      <h3 className="font-medium text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Size: {item.selectedSize}
                      </p>
                    </div>
                    <div className="flex items-end justify-between mt-2">
                       <div className="flex items-baseline gap-2">
                        <p className="font-bold text-destructive">
                          {currencyFormatter.format(item.price)}
                        </p>
                        {item.originalPrice && (
                          <p className="text-sm text-muted-foreground line-through">
                            {currencyFormatter.format(item.originalPrice)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                         <Select defaultValue={String(item.quantity)}>
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder="Qty" />
                            </SelectTrigger>
                            <SelectContent>
                                {[1, 2, 3, 4, 5].map(q => (
                                    <SelectItem key={q} value={String(q)}>{q}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-1 mt-10 lg:mt-0">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="flex items-center gap-2">
                    <Input placeholder="Gift card or promo code" />
                    <Button variant="outline">Apply</Button>
                </div>
                <Separator />
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{currencyFormatter.format(subtotal)}</span>
                    </div>
                     {savings > 0 && (
                        <div className="flex justify-between text-destructive">
                            <span>Savings</span>
                            <span>-{currencyFormatter.format(savings)}</span>
                        </div>
                    )}
                     <div className="flex justify-between">
                        <span>Shipping</span>
                        <span>{currencyFormatter.format(shipping)}</span>
                    </div>
                </div>
                 <Separator />
                 <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{currencyFormatter.format(total)}</span>
                </div>
                <Button className="w-full" size="lg" asChild>
                  <Link href="/checkout">Continue to Checkout</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {items.length > 0 && (
         <div className="fixed bottom-16 left-0 right-0 border-t bg-background p-4 lg:hidden">
             <div className="flex justify-between items-center mb-2">
                 <span className="font-bold text-lg">Total</span>
                 <span className="font-bold text-lg">{currencyFormatter.format(total)}</span>
             </div>
             <Button className="w-full" size="lg" asChild>
               <Link href="/checkout">Continue to Checkout</Link>
             </Button>
         </div>
       )}
    </div>
  );
}
