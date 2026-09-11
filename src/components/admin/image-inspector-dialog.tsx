'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Maximize2, Minimize2, Star, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fetchImageFileInfo, formatBytes, type ImageFileInfo } from '@/lib/image-meta';
import type { ProductImage } from '@/lib/types';

interface Props {
  images: ProductImage[];
  /** Which photo is open; `null` closes the dialog. */
  index: number | null;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
  onRemove: (index: number) => void;
  onSetMain: (index: number) => void;
}

/**
 * The admin's real look at a listing photo.
 *
 * The grid tile is a 150px optimised thumbnail, which is exactly the wrong
 * thing to judge a photo by: a blurry 400px upload and a crisp 3000px one
 * look the same there. This shows the **original file** — a plain `<img>`,
 * not `next/image`, so no resizing or re-encoding sits between the admin
 * and the bytes the seller uploaded — with its pixel dimensions, file size
 * and type, and a 1:1 mode for checking sharpness.
 *
 * Remove and Set as main act on the page's image state; like drag-reorder
 * and the tile's X, they take effect when the listing is saved.
 */
export function ImageInspectorDialog({ images, index, onClose, onChangeIndex, onRemove, onSetMain }: Props) {
  const open = index !== null && index >= 0 && index < images.length;
  const image = open ? images[index as number] : null;
  const [dims, setDims] = React.useState<{ w: number; h: number } | null>(null);
  const [file, setFile] = React.useState<ImageFileInfo | null>(null);
  const [actualSize, setActualSize] = React.useState(false);

  React.useEffect(() => {
    setDims(null);
    setFile(null);
    setActualSize(false);
    if (!image?.url) return;
    let cancelled = false;
    fetchImageFileInfo(image.url).then((info) => {
      if (!cancelled) setFile(info);
    });
    return () => {
      cancelled = true;
    };
  }, [image?.url]);

  const go = React.useCallback(
    (delta: number) => {
      if (index === null || images.length === 0) return;
      onChangeIndex((index + delta + images.length) % images.length);
    },
    [index, images.length, onChangeIndex],
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go]);

  if (!open || !image || index === null) {
    return <Dialog open={false} onOpenChange={(o) => !o && onClose()} />;
  }

  const total = images.length;
  const mainLabel = index === 0 ? 'Main photo' : `Photo ${index + 1} of ${total}`;
  const meta = [
    dims ? `${dims.w} × ${dims.h} px` : 'measuring…',
    file ? formatBytes(file.bytes) : 'reading size…',
    file?.contentType ?? null,
  ].filter(Boolean).join(' · ');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92dvh] overflow-hidden flex flex-col gap-3 p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">{mainLabel}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{meta}</DialogDescription>
        </DialogHeader>

        <div
          className={
            actualSize
              ? 'relative flex-1 min-h-0 overflow-auto rounded-md bg-muted'
              : 'relative flex-1 min-h-0 flex items-center justify-center rounded-md bg-muted'
          }
        >
          {!dims && (
            <Loader2 className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- the original bytes, unresized, are the point */}
          <img
            key={image.url}
            src={image.url}
            alt={`Listing photo ${index + 1}`}
            onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className={actualSize ? 'max-w-none' : 'max-h-[60dvh] max-w-full object-contain'}
            style={actualSize && dims ? { width: dims.w, height: dims.h } : undefined}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => go(-1)} disabled={total < 2}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => go(1)} disabled={total < 2}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setActualSize((v) => !v)} disabled={!dims}>
            {actualSize ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {actualSize ? 'Fit to screen' : 'View at 1:1'}
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={image.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Open original
            </a>
          </Button>
          <span className="flex-1" />
          <Button type="button" variant="secondary" size="sm" onClick={() => onSetMain(index)} disabled={index === 0}>
            <Star className="h-4 w-4" /> Set as main
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              onRemove(index);
              if (total <= 1) onClose();
              else onChangeIndex(Math.min(index, total - 2));
            }}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Removing or reordering here changes the listing when you click Save Changes.
        </p>
      </DialogContent>
    </Dialog>
  );
}
