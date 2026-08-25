'use client';

import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * The credit shown on hover. Kept in Albanian deliberately — it names Albanian
 * institutions, and this is the wording they are credited under.
 */
const SUPPORT_NOTE =
  'Marigo App realizohet me mbështetjen financiare të Qeverisë Shqiptare përmes ' +
  'Ministrisë së Ekonomisë dhe Inovacionit, në kuadër të skemës Grant 2026, ' +
  'dhe zbatohet nga Agjencia Innovation4Albania.';

/**
 * Supporter logos for the footer's first column.
 *
 * The two marks are matched on **height**, not width: the Startup Albania
 * wordmark is 2.9:1 and the ministry emblem is roughly square, so equal widths
 * would make one tower over the other. A shared height is what reads as "the
 * same size" for logos of different proportions.
 *
 * The ministry emblem is black line art, so it is inverted in dark mode — the
 * admin sidebar can leave `dark` on the document element, and it would
 * otherwise vanish into the background. The Startup Albania mark is a mid grey
 * that holds up either way.
 */
export function PartnerLogos() {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Focusable so the credit is reachable without a mouse. The images
              carry their own alt text; this adds the relationship between them
              that the tooltip spells out. */}
          <div
            tabIndex={0}
            aria-label={SUPPORT_NOTE}
            className="mt-6 flex w-fit max-w-full flex-wrap items-center gap-4 rounded-md outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image
              src="/partners/startup-albania.png"
              alt="Startup Albania Agency"
              width={646}
              height={226}
              className="h-12 w-auto"
            />
            <Image
              src="/partners/ministria-ekonomise-inovacionit.png"
              alt="Ministria e Ekonomisë dhe Inovacionit"
              width={420}
              height={475}
              className="h-12 w-auto dark:invert"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-center leading-relaxed">
          {SUPPORT_NOTE}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
