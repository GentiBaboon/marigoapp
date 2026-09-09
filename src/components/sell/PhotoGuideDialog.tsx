'use client';

import * as React from 'react';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PHOTO_GUIDE_IMAGES, PHOTO_GUIDE_TITLE } from '@/lib/photo-guide';

/**
 * "The perfect pictures guide" — the team's designed how-to, opened from a
 * text link under the photo dropzone in the sell wizard.
 *
 * The guide is shown as the rendered strips of the original document
 * (`src/lib/photo-guide.ts`), not rebuilt in HTML, so it looks exactly as
 * designed and can be swapped by re-rendering the PDF. The dialog scrolls
 * itself: Radix `DialogContent` has no max-height (CLAUDE.md §13), and this
 * content is far taller than any phone.
 */
export function PhotoGuideDialog({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            className ??
            'inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm'
          }
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {PHOTO_GUIDE_TITLE}
        </button>
      </DialogTrigger>
      {/* The shadcn close button is DialogContent's last child, absolutely
          positioned; it must stack above the sticky header or the header's
          backdrop covers it. */}
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-lg [&>button:last-child]:z-20">
        <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <DialogTitle>{PHOTO_GUIDE_TITLE}</DialogTitle>
          <DialogDescription>
            How to photograph an item so it is approved quickly and sells faster.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-white">
          {PHOTO_GUIDE_IMAGES.map((img, i) => (
            <Image
              key={img.src}
              src={img.src}
              alt={img.alt}
              width={img.width}
              height={img.height}
              sizes="(max-width: 640px) 100vw, 512px"
              className="block h-auto w-full"
              // The first strip is what opens with the dialog; the rest can
              // load as the reader scrolls.
              priority={open && i === 0}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
