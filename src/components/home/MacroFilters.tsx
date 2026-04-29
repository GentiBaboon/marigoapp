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
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {visible.map((filter) => (
        <button
          key={filter.id}
          onClick={() => handleSelect(filter.id)}
          className={cn(
            'flex-shrink-0 w-36 h-14 rounded-xl border text-base font-semibold uppercase tracking-widest font-body transition-all',
            activeFilter === filter.id
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background border-border text-foreground hover:border-foreground'
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
