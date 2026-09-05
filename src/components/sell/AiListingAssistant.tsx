'use client';

/**
 * The AI listing screen: drop in photos, add a line of context, get a
 * pre-filled draft back.
 *
 * Two sizes of image are kept on purpose. The originals (compressed the same
 * way the manual Photos step compresses them) go into the draft and are what
 * eventually get published. A much smaller copy is what we send to the model —
 * nine full-size photos would blow past the API body limit and the 30s function
 * ceiling, and the model does not need the detail to tell a black satin dress
 * from a leather boot.
 */

import * as React from 'react';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import { ANALYSIS_COMPRESSION, fileToDataUri } from '@/lib/image-for-model';
import { useDropzone } from 'react-dropzone';
import { getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSellForm } from '@/components/sell/SellFormContext';
import type { SellFormValues } from '@/lib/types';
import {
  Sparkles, ImagePlus, X, ArrowLeft, Loader2, Info,
} from 'lucide-react';

/** The brief says up to nine photos on this path. */
const MAX_IMAGES = 9;

/** What goes into the draft — matches the manual Photos step's settings. */
const STORAGE_COMPRESSION = { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true };
/** What goes to the model — small enough that nine of them still fit in a request. */


interface StagedImage {
  id: string;
  /** Object URL for the on-screen thumbnail. */
  preview: string;
  /** Full-quality-ish file that will be published. */
  file: File;
  name: string;
  type: string;
}

interface AiListingAssistantProps {
  onBack: () => void;
  /** Hands the finished draft to the wizard, which opens it at Review. */
  onDrafted: (data: Partial<SellFormValues>, note: string) => void;
}

export function AiListingAssistant({ onBack, onDrafted }: AiListingAssistantProps) {
  const [images, setImages] = React.useState<StagedImage[]>([]);
  const [hint, setHint] = React.useState('');
  const [isWorking, setIsWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  // Object URLs leak if they outlive the component.
  React.useEffect(() => {
    return () => images.forEach((img) => URL.revokeObjectURL(img.preview));
    // Intentionally on unmount only; per-image revokes happen in removeImage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = React.useCallback(async (accepted: File[]) => {
    setError(null);
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast({ title: `That's the limit`, description: `You can add up to ${MAX_IMAGES} photos.` });
      return;
    }
    const batch = accepted.slice(0, room);
    if (accepted.length > room) {
      toast({ title: 'Some photos were skipped', description: `Only ${MAX_IMAGES} photos can be used.` });
    }

    try {
      const staged = await Promise.all(
        batch.map(async (file, i) => {
          const compressed = await imageCompression(file, STORAGE_COMPRESSION);
          return {
            id: `${Date.now()}_${i}`,
            preview: URL.createObjectURL(compressed),
            file: new File([compressed], file.name, { type: compressed.type || file.type }),
            name: file.name,
            type: compressed.type || file.type || 'image/jpeg',
          } satisfies StagedImage;
        }),
      );
      setImages((prev) => [...prev, ...staged]);
    } catch {
      setError('One of those photos could not be processed. Try a different file.');
    }
  }, [images.length, toast]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    noClick: true,
    noKeyboard: true,
  });

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleSend = async () => {
    if (images.length === 0 || isWorking) return;
    setIsWorking(true);
    setError(null);

    try {
      const user = getAuth().currentUser;
      if (!user) throw new Error('You need to be signed in to use the assistant.');
      const idToken = await user.getIdToken();

      // Shrink hard for the model — see the note at the top of this file.
      const analysisImages = await Promise.all(
        images.map(async (img) => {
          const small = await imageCompression(img.file, ANALYSIS_COMPRESSION);
          return fileToDataUri(small);
        }),
      );

      const res = await fetch('/api/ai/draft-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ images: analysisImages, hint: hint.trim() || undefined }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'The assistant could not draft this listing.');

      onDrafted(
        {
          ...data.draft,
          // The photos the seller actually publishes are the larger copies held
          // here, not the thumbnails the model looked at.
          images: images.map((img, position) => ({
            url: img.preview,
            file: img.file,
            position,
            name: img.name,
            type: img.type,
          })),
        },
        data.note || '',
      );
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. You can still list manually.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} disabled={isWorking}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h2 className="flex items-center gap-2 font-headline text-xl font-bold">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Assistant
        </h2>
      </div>

      <Card className="border-primary/30 bg-primary/5 p-4">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">How this works</p>
            <p className="text-muted-foreground">
              Add up to {MAX_IMAGES} clear photos and a short note with the brand — for
              example <span className="font-medium text-foreground">&ldquo;Zara Black Satin Dress&rdquo;</span>.
              The assistant reads the photos, fills in the details and suggests a price.
              It saves as a draft for you to check before anything is published.
            </p>
          </div>
        </div>
      </Card>

      <div {...getRootProps()} className="space-y-3">
        <input {...getInputProps()} />

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                <Image src={img.preview} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="120px" unoptimized />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  disabled={isWorking}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/80 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Cover
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={open}
            disabled={isWorking}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            } disabled:opacity-50`}
          >
            <ImagePlus className="h-7 w-7 text-muted-foreground" />
            <span className="text-sm font-medium">
              {isDragActive ? 'Drop them here' : 'Add photos'}
            </span>
            <span className="text-xs text-muted-foreground">
              {images.length}/{MAX_IMAGES} added
            </span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="ai-hint" className="text-sm font-medium">
          Tell the assistant about it
        </label>
        <Textarea
          id="ai-hint"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          disabled={isWorking}
          rows={3}
          maxLength={500}
          placeholder="e.g. Zara Black Satin Dress, worn twice, size M"
        />
        <p className="text-xs text-muted-foreground">
          The brand helps most — the rest the assistant can usually see.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        size="lg"
        className="w-full gap-2"
        onClick={handleSend}
        disabled={images.length === 0 || isWorking}
      >
        {isWorking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading your photos…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Create my draft
          </>
        )}
      </Button>

      {isWorking && (
        <p className="text-center text-xs text-muted-foreground">
          This usually takes a few seconds. Please keep this screen open.
        </p>
      )}
    </div>
  );
}
