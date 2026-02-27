'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import { useCurrency } from '@/context/CurrencyContext';

export function OrderSummary() {
  const { items, subtotal, totalShipping, grandTotal } = useCart();
  const { formatPrice } = useCurrency();

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {items.map(item => {
                // Determine the correct image source (URL or placeholder)
                const imageUrl = item.image || 'https://placehold.co/100x100?text=No+Image';
                
                return (
                    <div key={item.id} className="flex gap-4 items-center">
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
                            <Image 
                                src={imageUrl} 
                                alt={item.title} 
                                fill 
                                className="object-cover" 
                                sizes="64px"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-xs uppercase tracking-wider truncate">{item.brand}</h3>
                            <p className="text-sm text-muted-foreground truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Size: {item.selectedSize || 'N/A'}</p>
                        </div>
                        <p className="font-semibold text-sm">{formatPrice(item.price)}</p>
                    </div>
                )
            })}
        </div>
        <Separator />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping (x{items.length})</span>
            <span>{formatPrice(totalShipping)}</span>
          </div>
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>{formatPrice(grandTotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
