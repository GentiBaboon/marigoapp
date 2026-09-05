'use client';

/**
 * A stored EUR amount, rendered in the operator's display currency.
 *
 * Admin tables held their own `new Intl.NumberFormat('de-DE', { currency:
 * 'EUR' })` and printed euro regardless of the currency picker, so the
 * products list showed "25,00 €" for a listing the seller had priced — and
 * the product page had just started showing — as 2.325 ALL.
 *
 * **Listing money only.** Finance figures (the revenue chart, payouts,
 * commission totals, Stripe amounts) stay in EUR on purpose: they reconcile
 * against Stripe, which settles in euro, and converting them would invite an
 * operator to compare a lek figure with a euro one from the dashboard.
 */
import { useCurrency } from '@/context/CurrencyContext';

export function Money({ eur, className }: { eur?: number | null; className?: string }) {
  const { formatPrice } = useCurrency();
  if (eur === null || eur === undefined || !Number.isFinite(eur)) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className={className ?? 'tabular-nums'}>{formatPrice(eur)}</span>;
}
