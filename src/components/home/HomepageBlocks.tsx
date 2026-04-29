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

function BlockCard({ block }: { block: HomepageBlock }) {
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

  const inner = (
    <div
      className="relative aspect-video w-full rounded-xl overflow-hidden bg-muted"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Images — stacked, only current is visible */}
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
            sizes="(max-width: 640px) 100vw, 50vw"
            priority={i === 0}
          />
        </div>
      ))}

      {/* Bottom overlay: gradient + text + dots */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent flex flex-col justify-end p-4 pointer-events-none">
        {/* Text */}
        <div>
          {title && (
            <p className="text-white font-bold text-base leading-snug drop-shadow-sm">{title}</p>
          )}
          {subtitle && (
            <p className="text-white/75 text-sm mt-0.5 drop-shadow-sm">{subtitle}</p>
          )}
        </div>

        {/* Swipe indicator dots */}
        {count > 1 && (
          <div className="flex gap-1.5 justify-center mt-3 pointer-events-auto">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrent(i); }}
                className={cn(
                  'h-[3px] rounded-full transition-all duration-200',
                  i === current ? 'w-5 bg-white' : 'w-2 bg-white/45',
                )}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return block.url ? (
    <Link href={block.url} className="block" onClick={handleLinkClick}>
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {visible.map((block) => (
        <BlockCard key={block.id} block={block} />
      ))}
    </div>
  );
}
