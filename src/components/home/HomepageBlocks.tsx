'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export interface BlockImage {
  url: string;
  x: number;
  y: number;
}

export interface HomepageBlock {
  id: string;
  images?: BlockImage[];
  title?: string;
  subtitle?: string;
  url: string;
  visible: boolean;
  order: number;
  // legacy
  imageUrl?: string;
  text?: string;
}

export interface HomepageBlocksConfig {
  blocks: HomepageBlock[];
}

function BlockCard({ block, full }: { block: HomepageBlock; full: boolean }) {
  const [current, setCurrent] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);
  const wasSwiped = React.useRef(false);

  const images: BlockImage[] =
    block.images && block.images.length > 0
      ? block.images.filter((i) => i.url)
      : block.imageUrl
      ? [{ url: block.imageUrl, x: 50, y: 50 }]
      : [];

  if (images.length === 0) return null;

  const title = block.title ?? block.text ?? '';
  const subtitle = block.subtitle ?? '';
  const count = images.length;

  const prev = () => setCurrent((i) => (i - 1 + count) % count);
  const next = () => setCurrent((i) => (i + 1) % count);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    wasSwiped.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      wasSwiped.current = true;
      delta < 0 ? next() : prev();
    }
    touchStartX.current = null;
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    if (wasSwiped.current) {
      e.preventDefault();
      wasSwiped.current = false;
    }
  };

  // A block carrying several images is treated as a poster set: one swipeable
  // frame on phones, every poster visible side by side from `sm` up. A single
  // image keeps the wide cinematic crop.
  const multi = count > 1;

  const inner = (
    <div
      className={cn(
        'relative w-full',
        multi
          ? 'aspect-[4/5] sm:aspect-auto sm:flex sm:gap-4 md:gap-6'
          : cn(
              'overflow-hidden bg-muted',
              full
                ? 'aspect-[3/2] sm:aspect-[2/1] lg:aspect-[21/9]'
                : 'aspect-[3/2] sm:aspect-video',
            ),
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {images.map((img, i) => (
        <div
          key={i}
          className={cn(
            'overflow-hidden bg-muted',
            multi
              ? cn(
                  // Phone: every poster stacked in the same frame, only the
                  // current one visible. Desktop: normal flow, all visible.
                  'absolute inset-0 transition-opacity duration-300',
                  'sm:static sm:flex-1 sm:aspect-[4/5] sm:opacity-100',
                  i === current ? 'opacity-100' : 'opacity-0 pointer-events-none sm:pointer-events-auto',
                )
              : 'absolute inset-0',
          )}
        >
          <div className="relative h-full w-full">
            <Image
              src={img.url}
              alt={i === 0 ? title : ''}
              fill
              className="object-cover"
              style={{ objectPosition: `${img.x}% ${img.y}%` }}
              sizes={multi ? '(max-width: 640px) 100vw, 50vw' : full ? '100vw' : '(max-width: 640px) 100vw, 50vw'}
              priority={i === 0}
            />
          </div>
        </div>
      ))}

      {/* Bottom overlay: gradient + text + dots.
          For a poster set this belongs to the single mobile frame only — from
          `sm` up the posters sit side by side and each carries its own artwork,
          so a gradient spanning the whole row (and swipe dots) makes no sense. */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col justify-end pointer-events-none',
          'p-4 sm:p-6',
          full && 'lg:p-10',
          multi && 'sm:hidden',
          // The scrim exists to keep overlay text legible. With no title or
          // subtitle it would just grey out the lower half of the artwork.
          (title || subtitle) && 'bg-gradient-to-t from-black/70 via-black/15 to-transparent',
        )}
      >
        {/* Text */}
        <div>
          {title && (
            <p
              className={cn(
                'text-white font-bold leading-tight drop-shadow-sm',
                full ? 'text-xl sm:text-3xl lg:text-4xl' : 'text-lg sm:text-xl lg:text-2xl',
              )}
            >
              {title}
            </p>
          )}
          {subtitle && (
            <p
              className={cn(
                'text-white/80 mt-1 drop-shadow-sm',
                full ? 'text-sm sm:text-base lg:text-lg' : 'text-sm lg:text-base',
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

      </div>
    </div>
  );

  // Swipe dots live under the frame rather than on top of it: the artwork is
  // self-contained and an overlaid pill covered the poster's own CTA.
  const dots = count > 1 && (
    <div className="flex gap-1.5 justify-center mt-3 sm:hidden">
      {images.map((_, i) => (
        <button
          key={i}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrent(i); }}
          className={cn(
            'h-[3px] rounded-full transition-all duration-200',
            i === current ? 'w-5 bg-foreground' : 'w-2 bg-foreground/25',
          )}
          aria-label={`Image ${i + 1}`}
        />
      ))}
    </div>
  );

  return (
    <div>
      {block.url ? (
        <Link href={block.url} className="block" onClick={handleLinkClick}>
          {inner}
        </Link>
      ) : (
        inner
      )}
      {dots}
    </div>
  );
}

export function HomepageBlocks() {
  const firestore = useFirestore();

  const blocksRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'homepage_blocks') : null),
    [firestore],
  );
  const { data } = useDoc<HomepageBlocksConfig>(blocksRef);

  const visible = (data?.blocks ?? [])
    .filter((b) => b.visible)
    .sort((a, b) => a.order - b.order);

  if (visible.length === 0) return null;

  // With a single block the two-column grid left half the row empty on
  // desktop, which is what made the banner look undersized. Only split into
  // columns once there is actually something to put beside it.
  const isSingle = visible.length === 1;

  return (
    <div className={cn('grid gap-4 md:gap-6', isSingle ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
      {visible.map((block) => (
        <BlockCard key={block.id} block={block} full={isSingle} />
      ))}
    </div>
  );
}
