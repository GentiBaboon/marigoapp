'use client';

import { cn } from '@/lib/utils';
import { useCurrency } from '@/context/CurrencyContext';

/** True when `originalPrice` is a real markdown over `price`. */
export function hasMarkdown(price: number, originalPrice?: number | null): originalPrice is number {
  return typeof originalPrice === 'number' && Number.isFinite(originalPrice) && originalPrice > price;
}

/** Whole-percent saving, e.g. 65 for 23.250 → 8.100. */
export function markdownPercent(price: number, originalPrice: number): number {
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

/**
 * A cart line's price with its markdown — the price paid, the struck-through
 * original and the saving. One component so the header popover, the cart
 * page and the checkout summary cannot show three different things for the
 * same line. Renders just the price when there is no markdown.
 */
export function CartLinePrice({
  price,
  originalPrice,
  className,
  priceClassName,
  align = 'start',
}: {
  price: number;
  originalPrice?: number | null;
  className?: string;
  priceClassName?: string;
  /** `end` right-aligns the stack, for a price column. */
  align?: 'start' | 'end';
}) {
  const { formatPrice } = useCurrency();
  const discounted = hasMarkdown(price, originalPrice);
  return (
    <div className={cn('flex flex-col', align === 'end' ? 'items-end text-right' : 'items-start', className)}>
      <span className={cn('font-bold', priceClassName)}>{formatPrice(price)}</span>
      {discounted && (
        <span className="flex items-baseline gap-1.5 text-xs leading-tight">
          <span className="text-muted-foreground line-through">{formatPrice(originalPrice)}</span>
          <span className="font-bold text-green-700">−{markdownPercent(price, originalPrice)}%</span>
        </span>
      )}
    </div>
  );
}
