'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type TimelineState = 'completed' | 'current' | 'upcoming';

/**
 * One step of an order timeline: its marker and the rail beneath it.
 *
 * The three timelines (buyer, seller, return) each drew a single
 * full-height line with `absolute inset` and then dropped absolutely
 * positioned dots near it. The two were positioned by different rules —
 * `left-2` for the line against `left-0` plus a translate for the dot — so
 * the circles sat beside the rail rather than on it, and any change to
 * either offset moved one without the other.
 *
 * Here the rail is *built out of* the steps: each row is a flex column
 * holding its own dot with the connector growing beneath it to the next
 * row. The line therefore starts at the bottom of a circle and ends at the
 * top of the next one by construction, at any row height, and there is no
 * offset left to drift.
 *
 * The connector inherits the step's own state, so the rail is green behind
 * what is done and grey ahead of it.
 */
export function TimelineStep({
  state,
  tone = 'blue',
  isLast = false,
  gap = 'pb-10',
  children,
}: {
  state: TimelineState;
  /** Colour of the *current* marker: the buyer's flow is blue, the seller's orange. */
  tone?: 'blue' | 'orange';
  isLast?: boolean;
  /** Space below the row's content, i.e. how long the connector runs. */
  gap?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex w-4 flex-col items-center self-stretch" aria-hidden="true">
        <span
          className={cn('h-4 w-4 shrink-0 rounded-full', {
            'bg-green-500': state === 'completed',
            'bg-blue-500 ring-4 ring-blue-200': state === 'current' && tone === 'blue',
            'bg-orange-500 ring-4 ring-orange-200': state === 'current' && tone === 'orange',
            'border-2 border-gray-300 bg-background': state === 'upcoming',
          })}
        />
        {!isLast && (
          <span
            className={cn('w-0.5 flex-1', state === 'completed' ? 'bg-green-500' : 'bg-gray-200')}
          />
        )}
      </div>
      <div className={cn('min-w-0 flex-1', isLast ? '' : gap)}>{children}</div>
    </div>
  );
}
