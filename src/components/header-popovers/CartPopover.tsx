'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { CartLinePrice } from '@/components/cart/line-price';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ShoppingCart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CartPopover() {
  const { items, removeFromCart, subtotal } = useCart();
  const { formatPrice } = useCurrency();
  const [open, setOpen] = React.useState(false);

  const totalItems = items.reduce((a, i) => a + i.quantity, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Shopping Cart" className="relative">
          <ShoppingCart className="h-6 w-6" />
          {totalItems > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {totalItems > 9 ? '9+' : totalItems}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[92vw] max-w-sm p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-bold">Cart {totalItems > 0 && <span className="text-muted-foreground font-normal">({totalItems})</span>}</p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-muted-foreground">
              <ShoppingCart className="mx-auto h-8 w-8 mb-2 opacity-60" />
              Your cart is empty.
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3">
                  <Link href={`/products/${item.productId || item.id}`} onClick={() => setOpen(false)} className="relative h-14 w-14 flex-shrink-0 rounded-md bg-muted overflow-hidden">
                    {item.image ? (
                      <Image src={item.image} alt={item.title} fill sizes="56px" className="object-cover" />
                    ) : null}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider truncate">{item.brand}</p>
                    <Link href={`/products/${item.productId || item.id}`} onClick={() => setOpen(false)} className="text-sm leading-tight line-clamp-2 hover:underline">
                      {item.title}
                    </Link>
                    <div className="flex items-baseline gap-2 mt-1">
                      <CartLinePrice price={item.price} originalPrice={item.originalPrice} priceClassName="text-sm" />
                      {item.quantity > 1 && <span className="text-xs text-muted-foreground">× {item.quantity}</span>}
                      {item.selectedSize && <span className="text-xs text-muted-foreground">· {item.selectedSize}</span>}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                    aria-label="Remove from cart"
                    onClick={() => removeFromCart(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="border-t p-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-base font-bold">{formatPrice(subtotal)}</span>
            </div>
            <Button asChild className="w-full" onClick={() => setOpen(false)}>
              <Link href="/checkout">Checkout</Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
