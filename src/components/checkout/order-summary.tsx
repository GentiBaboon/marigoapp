'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/context/CurrencyContext';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Tag, X } from 'lucide-react';

export function OrderSummary() {
  const { items, removeFromCart, subtotal, totalShipping, grandTotal, appliedCoupon, discountAmount } = useCart();
  const { formatPrice } = useCurrency();
  const router = useRouter();

  const getProductImage = (image: string) => {
    if (image.startsWith('http') || image.startsWith('data:') || image.startsWith('blob:')) return image;
    const placeholder = PlaceHolderImages.find(p => p.id === image);
    return placeholder?.imageUrl || 'https://placehold.co/100x100?text=No+Image';
  }

  /**
   * Removing the *last* item would leave the visitor on /checkout, which
   * renders an indefinite spinner whenever the cart is empty (the reactive
   * empty-cart redirect was removed because it raced the post-order success
   * push). Navigating here instead is safe: it is driven by a click, not by
   * cart state, so it cannot fire during that transition.
   */
  const handleRemove = (itemId: string) => {
    const wasLastItem = items.length === 1;
    removeFromCart(itemId);
    if (wasLastItem) router.push('/cart');
  };

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {items.map(item => {
                const imageUrl = getProductImage(item.image);
                
                return (
                    <div key={item.id} className="group flex gap-4 items-center">
                        <Link
                            href={`/products/${item.productId || item.id}`}
                            className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border bg-muted"
                        >
                            <Image
                                src={imageUrl}
                                alt={item.title}
                                fill
                                className="object-cover"
                                sizes="64px"
                                unoptimized={imageUrl.startsWith('blob:')}
                            />
                        </Link>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-xs uppercase tracking-wider truncate">{item.brand}</h3>
                            <p className="text-sm text-muted-foreground truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Size: {item.selectedSize || 'N/A'}</p>
                        </div>
                        <p className="font-semibold text-sm">{formatPrice(item.price)}</p>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${item.title} from your order`}
                            // Always reachable on touch, where there is no hover
                            // to reveal it.
                            className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(item.id)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
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
          {appliedCoupon && (
              <div className="flex justify-between text-green-600 font-medium">
                <span className="flex items-center gap-1.5"><Tag className="h-3 w-3" /> {appliedCoupon.code}</span>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>
                {totalShipping === 0 ? <span className="text-green-600 font-bold">FREE</span> : formatPrice(totalShipping)}
            </span>
          </div>
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-primary">{formatPrice(grandTotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
