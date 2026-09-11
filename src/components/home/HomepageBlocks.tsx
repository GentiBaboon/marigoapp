'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
  DEFAULT_BLOCK_CTA,
  blockImages,
  visibleBlocks,
  type BlockImage,
  type HomepageBlock,
  type HomepageBlocksConfig,
} from '@/lib/homepage-blocks';

// The types and the pure helpers live in `src/lib/homepage-blocks.ts` so the
// server can read the same document; re-exported for the admin tab's imports.
export { DEFAULT_BLOCK_CTA };
export type { BlockImage, HomepageBlock, HomepageBlocksConfig };

/**
 * One editorial hero, in the shape of Farfetch's homepage banner: copy on the
 * left and a single tall image on the right from `md` up; on a phone the image
 * comes first and the copy sits underneath it. The copy is never laid over the
 * photo, so there is no scrim and the focal point only decides the crop.
 *
 * A block carrying several images keeps them, one at a time, inside the image
 * frame — swipe on touch, dots everywhere.
 */
function HeroBlock({ block }: { block: HomepageBlock }) {
  const [current, setCurrent] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);
  const wasSwiped = React.useRef(false);

  const images: BlockImage[] = blockImages(block);

  if (images.length === 0) return null;

  const title = block.title ?? block.text ?? '';
  const subtitle = block.subtitle ?? '';
  const cta = (block.ctaLabel ?? '').trim() || DEFAULT_BLOCK_CTA;
  const hasCopy = Boolean(title || subtitle);
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

  // A swipe that ends on the link must not also follow it.
  const handleLinkClick = (e: React.MouseEvent) => {
    if (wasSwiped.current) {
      e.preventDefault();
      wasSwiped.current = false;
    }
  };

  const picture = (
    <div
      className="relative aspect-[4/5] w-full overflow-hidden bg-muted md:aspect-square"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {images.map((img, i) => (
        <div
          key={i}
          className={cn(
            'absolute inset-0 transition-opacity duration-300',
            i === current ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          <Image
            src={img.url}
            alt={i === 0 ? title : ''}
            fill
            className="object-cover"
            style={{ objectPosition: `${img.x}% ${img.y}%` }}
            sizes={hasCopy ? '(max-width: 768px) 100vw, 50vw' : '100vw'}
            priority={i === 0}
          />
        </div>
      ))}
    </div>
  );

  const dots = count > 1 && (
    <div className="mt-3 flex justify-center gap-1.5">
      {images.map((_, i) => (
        <button
          key={i}
          type="button"
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

  const frame = (
    <div className={cn(hasCopy && 'md:order-2')}>
      {block.url ? (
        <Link href={block.url} className="block" onClick={handleLinkClick} aria-label={title || cta}>
          {picture}
        </Link>
      ) : (
        picture
      )}
      {dots}
    </div>
  );

  // No copy at all: the photo is the whole banner, edge to edge.
  if (!hasCopy) return frame;

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center md:gap-10 lg:gap-16">
      {frame}

      <div className="flex flex-col items-start gap-4 md:order-1 md:items-center md:px-6 md:text-center lg:px-12">
        {title && (
          <h1 className="font-headline text-3xl leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-lg leading-snug text-foreground/80 sm:text-xl lg:text-2xl">
            {subtitle}
          </p>
        )}
        {block.url && (
          <Link
            href={block.url}
            className={cn(
              'mt-2 inline-flex h-12 w-full items-center justify-center border border-foreground px-8',
              'text-sm font-semibold uppercase tracking-wide text-foreground transition-colors',
              'hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'md:w-auto',
            )}
          >
            {cta}
          </Link>
        )}
      </div>
    </section>
  );
}

/**
 * `initialBlocks` is the server's copy of the document (`fetchHomepageBlocks`),
 * already filtered to the visible ones. It is what the HTML carries, so the
 * hero — and with it the LCP image, preloaded by `priority` — is painted
 * before the Firebase SDK has even loaded. The live document replaces it as
 * soon as the listener delivers; until then (and on any read failure) the
 * server copy stays up rather than flashing the hero out and back in.
 */
export function HomepageBlocks({ initialBlocks = null }: { initialBlocks?: HomepageBlock[] | null }) {
  const firestore = useFirestore();

  const blocksRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'homepage_blocks') : null),
    [firestore],
  );
  const { data } = useDoc<HomepageBlocksConfig>(blocksRef);

  const visible = data?.blocks ? visibleBlocks(data.blocks) : (initialBlocks ?? []);

  if (visible.length === 0) return null;

  // Each block is a full-width hero row; several of them stack.
  return (
    <div className="space-y-10 md:space-y-16">
      {visible.map((block) => (
        <HeroBlock key={block.id} block={block} />
      ))}
    </div>
  );
}
