'use client';

import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SizeChartDoc {
  id: string;
  categoryType: string;
  sizeSystem: string;
  sizes: string[];
  isActive?: boolean;
}

interface SizeGuideProps {
  /** Top-level category name from the product, e.g. "Shoes". */
  categoryType?: string;
  /** Size system stored on the product, e.g. "EU". May be missing on older
   *  listings — in that case all systems for the category are shown. */
  sizeSystem?: string;
  /** The size currently selected/displayed on the product page, used to
   *  highlight the matching cell in each row. */
  currentSize?: string;
}

export function SizeGuide({ categoryType, sizeSystem, currentSize }: SizeGuideProps) {
  const firestore = useFirestore();
  const [open, setOpen] = React.useState(false);

  const chartsQuery = useMemoFirebase(() => {
    if (!firestore || !categoryType) return null;
    return query(collection(firestore, 'size_charts'), where('categoryType', '==', categoryType));
  }, [firestore, categoryType]);

  const { data: charts } = useCollection<SizeChartDoc>(chartsQuery);

  const active = (charts ?? []).filter(c => c.isActive !== false);

  // If the product has a sizeSystem, show that row at the top; otherwise list
  // every system for the category as separate rows so the buyer can compare.
  const rows = sizeSystem
    ? [
        ...active.filter(c => c.sizeSystem === sizeSystem),
        ...active.filter(c => c.sizeSystem !== sizeSystem),
      ]
    : active;

  if (!categoryType || active.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs underline-offset-2">
          <Ruler className="h-3 w-3 mr-1" />
          Size guide
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[92vw] max-w-lg p-0">
        <div className="px-3 py-2 border-b flex items-center gap-2">
          <Ruler className="h-4 w-4" />
          <p className="text-sm font-bold">{categoryType} size chart</p>
        </div>
        <div className="max-h-[60vh] overflow-auto p-3 space-y-3 text-sm">
          {rows.map((row) => {
            const isPrimary = sizeSystem && row.sizeSystem === sizeSystem;
            return (
              <div key={row.id} className="space-y-1">
                <p className={cn('text-xs font-bold uppercase tracking-wider', isPrimary ? 'text-foreground' : 'text-muted-foreground')}>
                  {row.sizeSystem}{isPrimary ? ' (this listing)' : ''}
                </p>
                <div className="flex flex-wrap gap-1">
                  {row.sizes.map((s) => (
                    <span
                      key={s}
                      className={cn(
                        'inline-flex min-w-[2.25rem] justify-center rounded border px-2 py-0.5 text-xs',
                        isPrimary && currentSize === s && 'bg-foreground text-background border-foreground font-bold',
                        (!isPrimary || currentSize !== s) && 'border-input',
                      )}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
