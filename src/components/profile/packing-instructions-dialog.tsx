'use client';

import * as React from 'react';
import { Box, ShieldCheck, Sparkles, Tag } from 'lucide-react';
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
 * **The copy below is a first draft, pending the team's own wording.** It is
 * one array precisely so replacing it is an edit to this list and nothing
 * else; keep each step to a title and one or two plain sentences, which is
 * what a seller standing over a box will actually read.
 */
const STEPS: Array<{ icon: React.ElementType; title: string; body: string }> = [
  {
    icon: Sparkles,
    title: 'Check the item one last time',
    body:
      'Make sure it matches your listing — same colour, same size, no marks you have not mentioned. A buyer who opens a surprise opens a dispute.',
  },
  {
    icon: ShieldCheck,
    title: 'Protect it',
    body:
      'Fold clothing along its natural seams and wrap it in tissue or a clean bag so it cannot rub in transit. Stuff bags and shoes so they keep their shape, and wrap handles, buckles and heels separately.',
  },
  {
    icon: Box,
    title: 'Use a box or mailer that closes properly',
    body:
      'The parcel should be snug, with nothing shifting when you shake it, and sealed all the way along the opening. Reuse a box if it is sturdy, but cover any old labels.',
  },
  {
    icon: Tag,
    title: 'Attach the shipping label',
    body:
      'Print it, tape it flat to the largest face of the parcel, and keep the barcode and the order number clear of the seams. Put a second copy inside the parcel if you have one.',
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
        <ul className="space-y-4">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground border-t pt-3">
          Once it is packed, mark the order as prepared and we arrange the pickup.
        </p>
      </DialogContent>
    </Dialog>
  );
}
