'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PERIODS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' },
] as const;

export type Period = typeof PERIODS[number]['value'];

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex gap-1 bg-muted rounded-lg p-1">
      {PERIODS.map((period) => (
        <Button
          key={period.value}
          variant={value === period.value ? 'secondary' : 'ghost'}
          size="sm"
          className={cn('h-7 px-3 text-xs', value === period.value && 'bg-background shadow-sm')}
          onClick={() => onChange(period.value)}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}
