'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

/**
 * Listing photos.
 *
 * Two presentations of the same images, chosen by pointer rather than by taste:
 *
 * - **Desktop** gets a vertical thumbnail rail beside one large image. With a
 *   mouse, seeing every angle at once and jumping straight to the one you want
 *   beats stepping through them.
 * - **Phones** keep the swipeable carousel. A thumbnail rail on a narrow screen
 *   either steals width from the photo or shrinks to unreadable stamps, and
 *   swiping is the gesture people already reach for.
 *
 * Both render the same `images` array, so there is one source of truth and no
 * chance of the two falling out of step.
 */
export function ProductGallery({
  images,
  title,
}: {
  images: Array<string | { url?: string }>;
  title: string;
}) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(1);
  const [active, setActive] = React.useState(0);
  const [failed, setFailed] = React.useState<Set<number>>(new Set());

  const urls = React.useMemo(
    () =>
      (images ?? [])
        .map(img => (typeof img === 'string' ? img : img?.url || ''))
        .filter(url => url.startsWith('http') || url.startsWith('data:')),
    [images]
  );

  const count = urls.length;

  React.useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap() + 1);
    const onSelect = () => setCurrent(api.selectedScrollSnap() + 1);
    api.on('select', onSelect);
    return () => { api.off('select', onSelect); };
  }, [api]);

  // A listing whose images all failed validation still needs to occupy the
  // column, or the details beside it jump up into the empty space.
  if (count === 0) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
        No photos
      </div>
    );
  }

  const activeUrl = urls[Math.min(active, count - 1)];

  return (
    <>
      {/* ── Desktop: thumbnail rail + main image ────────────────────────── */}
      <div className="hidden gap-4 md:flex">
        {count > 1 && (
          <div
            className="flex max-h-[560px] w-20 shrink-0 flex-col gap-3 overflow-y-auto pr-1"
            role="listbox"
            aria-label="Product photos"
          >
            {urls.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                aria-label={`Show photo ${i + 1} of ${count}`}
                // Click, not hover: with hover-to-preview, moving the cursor
                // off a thumbnail you just picked sweeps across its neighbours
                // and silently overrides the choice.
                onClick={() => setActive(i)}
                className={cn(
                  'relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-md bg-muted transition',
                  // A ring rather than a border: a border would resize the
                  // thumbnail as it activates and shuffle the whole rail.
                  i === active
                    ? 'ring-2 ring-primary ring-offset-1'
                    : 'opacity-70 hover:opacity-100'
                )}
              >
                {failed.has(i) ? (
                  <span className="flex h-full items-center justify-center text-[9px] text-muted-foreground">
                    n/a
                  </span>
                ) : (
                  <Image
                    src={url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                    unoptimized={url.startsWith('data:')}
                    onError={() => setFailed(prev => new Set(prev).add(i))}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="relative aspect-[3/4] min-w-0 flex-1 overflow-hidden rounded-lg bg-muted">
          {failed.has(active) ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Image unavailable
            </div>
          ) : (
            <Image
              key={activeUrl}
              src={activeUrl}
              alt={`${title} image ${active + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 50vw, 40vw"
              priority={active === 0}
              unoptimized={activeUrl.startsWith('data:')}
              onError={() => setFailed(prev => new Set(prev).add(active))}
            />
          )}
        </div>
      </div>

      {/* ── Phones: swipe ──────────────────────────────────────────────── */}
      <Carousel setApi={setApi} className="relative w-full md:hidden">
        <CarouselContent>
          {urls.map((url, index) => (
            <CarouselItem key={`${url}-${index}`}>
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
                {failed.has(index) ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Image unavailable
                  </div>
                ) : (
                  <Image
                    src={url}
                    alt={`${title} image ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={index === 0}
                    unoptimized={url.startsWith('data:')}
                    onError={() => setFailed(prev => new Set(prev).add(index))}
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {count > 1 && (
          <div className="absolute bottom-4 right-4 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white">
            {current} / {count}
          </div>
        )}
        {/* Kept for pointer users on a narrow window; touch users swipe. */}
        {count > 1 && (
          <div className="pointer-events-none absolute inset-y-0 right-2 hidden items-center">
            <div className="pointer-events-auto flex flex-col gap-2">
              <CarouselPrevious className="static h-9 w-9 translate-x-0 translate-y-0 border-none bg-black/50 text-white opacity-80 shadow-none transition hover:bg-black/70 hover:text-white hover:opacity-100 disabled:opacity-30" />
              <CarouselNext className="static h-9 w-9 translate-x-0 translate-y-0 border-none bg-black/50 text-white opacity-80 shadow-none transition hover:bg-black/70 hover:text-white hover:opacity-100 disabled:opacity-30" />
            </div>
          </div>
        )}
      </Carousel>
    </>
  );
}
