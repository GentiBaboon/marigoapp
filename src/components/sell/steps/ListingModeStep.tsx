'use client';

/**
 * The fork at the top of the sell flow: fill the form yourself, or hand the
 * assistant some photos and review what it drafts.
 *
 * Deliberately not one of the numbered wizard steps — it decides *how* the
 * wizard gets filled, and folding it into the count would renumber every
 * existing step and the progress bar with it.
 */

import { Card } from '@/components/ui/card';
import { Sparkles, PencilLine, ChevronRight } from 'lucide-react';

interface ListingModeStepProps {
  onManual: () => void;
  onAssisted: () => void;
}

export function ListingModeStep({ onManual, onAssisted }: ListingModeStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="font-headline text-2xl font-bold">How would you like to list?</h2>
        <p className="text-sm text-muted-foreground">
          Both end up in the same place — you review everything before it goes live.
        </p>
      </div>

      <div className="grid gap-3">
        <Card
          role="button"
          tabIndex={0}
          onClick={onAssisted}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAssisted();
            }
          }}
          className="group cursor-pointer border-2 p-5 transition hover:border-primary focus-visible:border-primary focus-visible:outline-none active:scale-[0.99]"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">List with AI Assistant</h3>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Fastest
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your photos and a few words. The assistant fills in the details,
                writes the description and suggests a price.
              </p>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
          </div>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={onManual}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onManual();
            }
          }}
          className="group cursor-pointer border-2 p-5 transition hover:border-foreground/40 focus-visible:border-foreground/40 focus-visible:outline-none active:scale-[0.99]"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-muted">
              <PencilLine className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">List manually</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Go through the steps yourself and control every field.
              </p>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
          </div>
        </Card>
      </div>
    </div>
  );
}
