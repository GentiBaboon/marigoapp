'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * How to pack an order, shown from the seller's preparation card.
 *
 * The link beside "Pack your item following our simple instructions" pointed
 * at `href="#"` — it looked like guidance existed and scrolled the page
 * instead.
 *
 * This is the team's own wording, replacing the placeholder draft that stood
 * here. Numbered rather than iconned: step 4 depends on step 3 being done
 * ("once the package is sealed"), so the order is part of the instruction and
 * four abstract icons hid that. Keep each step to a title and one plain
 * sentence — this is read by someone standing over a box.
 */
const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Prepare your item',
    body: 'Clean it, iron or polish it, and fold it.',
  },
  {
    title: 'Find an appropriate packing bag',
    body: 'Pick one the item fits into properly.',
  },
  {
    title: 'Include everything in the product details',
    body:
      'Label, certificate, dustbag and anything else you mentioned in the listing has to go in the parcel.',
  },
  {
    title: 'Seal it, then attach the shipping label',
    body: 'Once the package is sealed, stick the shipping label on it.',
  },
];

export function PackingInstructionsDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {/* Radix gives DialogContent no max height, so a list this long would
          scroll its own footer off a phone screen. */}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How to pack your order</DialogTitle>
          <DialogDescription>
            A few minutes here is what keeps an item arriving as the buyer pictured it.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4">
          {STEPS.map(({ title, body }, i) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary-deep">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground border-t pt-3">
          Once it is packed, mark the order as prepared and we arrange the pickup.
        </p>
      </DialogContent>
    </Dialog>
  );
}
