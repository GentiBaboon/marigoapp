'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Leaf, ShieldCheck, Sparkles, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PartnerLogos } from '@/components/PartnerLogos';
import {
  DEFAULT_COMMISSION_RATE,
  DEFAULT_PAYOUT_HOLD_HOURS,
  DEFAULT_REFUND_WINDOW_DAYS,
} from '@/lib/types';

const commissionPct = Math.round(DEFAULT_COMMISSION_RATE * 100);

/**
 * Figures come from `src/lib/types.ts` for the same reason the Help Centre's
 * do: a marketing page that quotes a commission the checkout no longer charges
 * is worse than one that quotes nothing.
 */
const PILLARS = [
  {
    icon: Sparkles,
    title: 'Curated, not endless',
    body:
      'Every piece is a single item with its own photographs, measurements and condition, listed by the person who owned it. When it sells, it is gone — this is a wardrobe, not a warehouse.',
  },
  {
    icon: Leaf,
    title: 'Fashion that gets a second life',
    body:
      'The most sustainable garment is the one already made. Buying pre-loved keeps good clothing in circulation, and selling what you no longer wear puts it somewhere it will be worn again.',
  },
  {
    icon: ShieldCheck,
    title: 'Money that waits for the parcel',
    body:
      `Card payments are held, not handed over. The seller is paid after the item arrives and a short hold passes, and you have ${DEFAULT_REFUND_WINDOW_DAYS} days to return anything that is not what was described.`,
  },
  {
    icon: Truck,
    title: 'Built for Albania and Kosovo',
    body:
      'Couriers we work with collect from the seller and deliver to your door, across both countries and between them. Prices are shown in lek, because that is what people here think in.',
  },
];

export default function AboutPage() {
  return (
    <div className="w-full">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Image
              src="/logo.png"
              alt="Marigo"
              width={2000}
              height={535}
              priority
              sizes="(min-width: 768px) 320px, 240px"
              className="mx-auto h-auto w-60 md:w-80"
            />
            <p className="mt-8 font-headline text-2xl leading-snug text-foreground md:text-3xl">
              A new fashion marketplace for Albania and Kosovo.
            </p>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              Marigo is a platform built to bring something unique to the fashion
              market — giving people access to sustainable fashion choices and a
              more personalised shopping experience.
            </p>
          </div>
        </div>
      </section>

      {/* ── What we are ──────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2 md:gap-12">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="space-y-2">
                <h2 className="font-headline text-xl font-bold">{title}</h2>
                <p className="leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-headline text-2xl font-bold md:text-3xl">How Marigo works</h2>
            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  If you are buying
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  Browse or search by brand, size, colour and condition. Message the
                  seller before you commit, or make them an offer instead of paying
                  the asking price. Your card is only charged once the item is on its
                  way to you, and the money reaches the seller after it arrives.
                </p>
                <Button asChild variant="outline" className="mt-2">
                  <Link href="/search">Start browsing</Link>
                </Button>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  If you are selling
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  Photograph the piece, and let the assistant write the description
                  and suggest a price if you would rather not. Listing is free —
                  Marigo takes {commissionPct}% only when something actually sells,
                  and pays out {DEFAULT_PAYOUT_HOLD_HOURS} hours after the buyer has
                  it in hand.
                </p>
                <Button asChild variant="outline" className="mt-2">
                  <Link href="/sell">List an item</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Supporters ───────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-headline text-2xl font-bold">Who backs us</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Marigo is built in Tirana, with the financial support of the Albanian
            Government through the Ministry of Economy and Innovation, under the
            Grant 2026 scheme, and implemented by Agjencia Innovation4Albania.
          </p>
          {/* The same credit the footer carries — hovering either shows the
              full Albanian wording the institutions are credited under. */}
          <div className="mt-8 flex justify-center">
            <PartnerLogos />
          </div>
        </div>
      </section>
    </div>
  );
}
