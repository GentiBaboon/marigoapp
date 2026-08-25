'use client';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useCurrency } from '@/context/CurrencyContext';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { UNKNOWN_CITY } from '@/lib/shipping';
import { Tag, X, Truck, Loader2 } from 'lucide-react';

/**
 * Resolve seller display names for the sellers in this basket.
 *
 * `users/{uid}` is world-readable per firestore.rules, and an order rarely has
 * more than two or three sellers, so this is a couple of reads. Falls back to
 * "Seller 1", "Seller 2" so the grouping still reads sensibly if a lookup
 * fails or a profile has no name.
 */
function useSellerNames(sellerIds: string[]) {
  const firestore = useFirestore();
  const [names, setNames] = React.useState<Record<string, string>>({});
  const key = sellerIds.join(',');

  React.useEffect(() => {
    if (!firestore) return;
    const ids = key.split(',').filter(Boolean);
    if (ids.length === 0) return;

    let cancelled = false;
    Promise.all(
      ids.map(async id => {
        try {
          const snap = await getDoc(doc(firestore, 'users', id));
          return [id, (snap.data()?.name as string) || ''] as const;
        } catch {
          return [id, ''] as const;
        }
      }),
    ).then(entries => {
      if (!cancelled) setNames(Object.fromEntries(entries));
    });

    return () => { cancelled = true; };
  }, [firestore, key]);

  return names;
}

export function OrderSummary() {
  const {
    items, removeFromCart, subtotal, totalShipping, shippingGroups,
    grandTotal, appliedCoupon, discountAmount, applyCoupon, removeCoupon,
  } = useCart();

  // Promo entry lives here as well as in the cart: a shopper who reaches
  // checkout with a code in hand should not have to go back a step to use it.
  // Both surfaces share CartContext, so applying in one is reflected in the
  // other — and the server revalidates regardless.
  const [codeInput, setCodeInput] = React.useState('');
  const [applying, setApplying] = React.useState(false);
  const [codeError, setCodeError] = React.useState<string | null>(null);

  const handleApplyCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setApplying(true);
    setCodeError(null);
    const result = await applyCoupon(code);
    if (result.success) {
      setCodeInput('');
    } else {
      setCodeError(result.message);
    }
    setApplying(false);
  };
  const { formatPrice } = useCurrency();
  const router = useRouter();

  // Defensive: a cart line missing its image used to throw on `.startsWith`
  // and take the whole checkout down with an error boundary. A malformed or
  // legacy line should cost a thumbnail, not the ability to pay.
  const getProductImage = (image: string | null | undefined) => {
    if (typeof image !== 'string' || !image) {
      return 'https://placehold.co/100x100?text=No+Image';
    }
    if (image.startsWith('http') || image.startsWith('data:') || image.startsWith('blob:')) return image;
    const placeholder = PlaceHolderImages.find(p => p.id === image);
    return placeholder?.imageUrl || 'https://placehold.co/100x100?text=No+Image';
  };

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

  // Group the basket by seller: a buyer receives one parcel per seller, so
  // that is the unit the summary should be legible in.
  const sellerGroups = React.useMemo(() => {
    const map = new Map<string, typeof items>();
    items.forEach(item => {
      const list = map.get(item.sellerId) ?? [];
      list.push(item);
      map.set(item.sellerId, list);
    });
    return [...map.entries()].map(([sellerId, sellerItems]) => ({
      sellerId,
      items: sellerItems,
      subtotal: sellerItems.reduce((sum, i) => sum + (i.price || 0), 0),
      city: sellerItems.find(i => i.shippingFromCity)?.shippingFromCity || '',
    }));
  }, [items]);

  const sellerNames = useSellerNames(sellerGroups.map(g => g.sellerId));
  const nameFor = (sellerId: string, index: number) =>
    sellerNames[sellerId] || `Seller ${index + 1}`;

  // Cities are only worth naming when there is more than one — a single-origin
  // order just says "Shipping".
  const hasMultipleOrigins = shippingGroups.length > 1;

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-5 max-h-96 overflow-y-auto pr-2">
          {sellerGroups.map((group, groupIndex) => (
            <div key={group.sellerId} className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider">
                  {nameFor(group.sellerId, groupIndex)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                  {group.city ? ` · ${group.city}` : ''}
                </p>
              </div>

              {group.items.map(item => {
                const imageUrl = getProductImage(item.image);
                return (
                  <div key={item.id} className="flex gap-4 items-center">
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
                      <h3 className="font-bold text-xs uppercase tracking-wider truncate">{item.brand || ''}</h3>
                      <p className="text-sm text-muted-foreground truncate">{item.title || 'Item'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Size: {item.selectedSize || 'N/A'}</p>
                    </div>
                    <p className="font-semibold text-sm">{formatPrice(item.price)}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${item.title || 'item'} from your order`}
                      className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Seller subtotal</span>
                <span className="font-medium text-foreground">{formatPrice(group.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Discount code */}
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-lg border border-green-600/30 bg-green-600/5 px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-500">
              <Tag className="h-3.5 w-3.5" />
              {appliedCoupon.code} applied
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { removeCoupon(); setCodeError(null); }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Input
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value); setCodeError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyCode(); } }}
                placeholder="Discount code"
                aria-label="Discount code"
                autoCapitalize="characters"
                className="h-10 uppercase placeholder:normal-case"
              />
              <Button
                variant="outline"
                className="h-10 shrink-0"
                onClick={handleApplyCode}
                disabled={applying || !codeInput.trim()}
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
              </Button>
            </div>
            {codeError && <p className="text-xs text-destructive">{codeError}</p>}
          </div>
        )}

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

          {/* One delivery line per city shipped from. Two sellers in the same
              city share a courier run, so they share a single fee — showing it
              per city is what makes that visible rather than surprising. */}
          {totalShipping === 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="text-green-600 font-bold">FREE</span>
            </div>
          ) : (
            shippingGroups.map(group => (
              <div key={group.key} className="flex justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Truck className="h-3 w-3" />
                  Shipping
                  {group.label !== UNKNOWN_CITY && (hasMultipleOrigins || group.isCrossBorder)
                    ? ` · ${group.label}`
                    : ''}
                  {/* Say why this line costs more, rather than leaving the
                      buyer to wonder at a 500 next to a 200. */}
                  {group.isCrossBorder && (
                    <span className="text-xs">(international)</span>
                  )}
                </span>
                <span>{formatPrice(group.feeEur)}</span>
              </div>
            ))
          )}

          {totalShipping > 0 && hasMultipleOrigins && (
            <p className="text-xs text-muted-foreground">
              Your items ship from {shippingGroups.length} cities, so delivery is charged per city.
            </p>
          )}
          {totalShipping > 0 && shippingGroups.some(g => g.isCrossBorder) && (
            <p className="text-xs text-muted-foreground">
              Some items ship from another country, which costs more to deliver.
            </p>
          )}
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
