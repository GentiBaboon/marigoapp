'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function OrderSummary() {
  const { items, subtotal } = useCart();

  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  const shipping = 15; // Example shipping cost
  const total = subtotal + shipping;

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
            {items.map(item => {
                const productImage = PlaceHolderImages.find(p => p.id === item.image);
                return (
                    <div key={item.id} className="flex gap-4 items-center">
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border">
                            {productImage && (
                                <Image src={productImage.imageUrl} alt={item.title} fill className="object-cover" sizes="64px"/>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-medium text-sm leading-tight">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-medium text-sm">{currencyFormatter.format(item.price)}</p>
                    </div>
                )
            })}
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{currencyFormatter.format(subtotal)}</span>
          </div>
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
      </CardContent>
    </Card>
  );
}
