'use client';

import { ShieldCheck, Star, Sparkles, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FirestoreUser } from '@/lib/types';
import { getSellerLevel, type SellerBadgeLevel } from '@/lib/types';
import { useBadgeSettings } from '@/hooks/use-badge-settings';

const STYLES: Record<SellerBadgeLevel, { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  trusted:  { icon: ShieldCheck, className: 'bg-slate-100 text-slate-700 border-slate-200' },
  expert:   { icon: Star,        className: 'bg-amber-50 text-amber-800 border-amber-200' },
  activist: { icon: Sparkles,    className: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' },
  official: { icon: BadgeCheck,  className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
};

interface SellerBadgeProps {
  user: Partial<FirestoreUser> | null | undefined;
  className?: string;
  /** When `true` only the icon + level color renders (compact). */
  iconOnly?: boolean;
}

export function SellerBadge({ user, className, iconOnly = false }: SellerBadgeProps) {
  const { data: settings } = useBadgeSettings();
  if (!user) return null;
  const badge = getSellerLevel(user, settings);
  if (!badge) return null;
  const { icon: Icon, className: styles } = STYLES[badge.level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        styles,
        className,
      )}
      title={badge.label}
    >
      <Icon className="h-3 w-3" />
      {!iconOnly && <span>{badge.label}</span>}
    </span>
  );
}
