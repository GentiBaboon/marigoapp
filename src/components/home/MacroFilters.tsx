'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export interface MacroFilter {
  id: string;
  label: string;
  enabled: boolean;
  productIds: string[];
  memberIds: string[];
}

export interface MacroFiltersConfig {
  filters: MacroFilter[];
}

export function MacroFilters() {
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get('macroFilter');

  const filtersRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'macro_filters') : null),
    [firestore]
  );
  const { data } = useDoc<MacroFiltersConfig>(filtersRef);

  const visible = data?.filters?.filter((f) => f.enabled) ?? [];
  if (visible.length === 0) return null;

  const handleSelect = (filterId: string) => {
    if (activeFilter === filterId) {
      router.push('/home');
    } else {
      router.push(`/home?macroFilter=${filterId}`);
    }
  };

  return (
    // overflow-x-auto keeps the row swipeable on narrow screens; the inner
    // w-max + mx-auto centres it once the buttons fit, without making the
    // first button unreachable when they don't.
    <div className="overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex w-max mx-auto gap-3 px-1 py-1">
        {visible.map((filter) => {
          const isActive = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => handleSelect(filter.id)}
              className={cn(
                'group relative flex-shrink-0 w-36 h-14 rounded-2xl overflow-hidden',
                // Matches the "Shop by Category" heading: serif, sentence case.
                'font-serif text-lg capitalize',
                // No fill — the glass reads from backdrop-blur, the lit top
                // edge and the soft neumorphic shadows alone.
                'bg-transparent backdrop-blur-md border transition-all duration-200',
                isActive
                  ? // Pressed in: shadows move inside, purple text and border.
                    'border-primary text-primary shadow-[inset_4px_4px_10px_rgba(0,0,0,0.12),inset_-4px_-4px_10px_rgba(255,255,255,0.95)]'
                  : // Raised: dark shadow low-right, white glow high-left.
                    'border-primary/45 text-foreground hover:border-primary hover:-translate-y-0.5 ' +
                      'shadow-[5px_5px_12px_rgba(0,0,0,0.10),-5px_-5px_12px_rgba(255,255,255,0.95),inset_0_1px_0_rgba(255,255,255,0.75)] ' +
                      'hover:shadow-[7px_7px_18px_rgba(0,0,0,0.13),-7px_-7px_18px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] ' +
                      'active:translate-y-0 active:shadow-[inset_4px_4px_10px_rgba(0,0,0,0.12),inset_-4px_-4px_10px_rgba(255,255,255,0.95)]'
              )}
            >
              {/* Faint sheen along the top edge — the glass highlight. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/45 to-transparent"
              />
              <span className="relative">{filter.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
