'use client';

/**
 * Preparing photos to send to a model.
 *
 * Two sizes exist on purpose. What a listing *publishes* is compressed for
 * quality (0.8 MB / 1200px, in `PhotosStep`); what a model *reads* is shrunk
 * much harder, because nine full-size photos blow past both the request body
 * limit and the 30s Vercel ceiling while buying no extra accuracy.
 *
 * This lives in one place so the AI listing assistant and the price suggestion
 * cannot disagree about what "small enough" means — the same reason
 * `attribute-options` and `listing-options` exist.
 */
import imageCompression from 'browser-image-compression';

/** Deliberately aggressive: the model reads shape, colour and wear, not grain. */
export const ANALYSIS_COMPRESSION = {
  maxSizeMB: 0.12,
  maxWidthOrHeight: 640,
  useWebWorker: true,
};

export function fileToDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

/**
 * A downscaled `data:` URI for one image, from either a `File` or a URL the
 * draft is holding.
 *
 * The sell wizard's draft stores `{ url, file? }`, and `url` may be a data URI
 * (rehydrated from localStorage), a `blob:` URL (this session) or an https one
 * (already uploaded). Only a `File`/`Blob` can be recompressed, so the others
 * are fetched back into one first.
 */
export async function toModelImage(source: { url?: string; file?: File | Blob }): Promise<string | null> {
  try {
    let blob: Blob | undefined = source.file;

    if (!blob && source.url) {
      // An https URL would need CORS and is already remote — not worth a
      // round trip when the model can be given fewer photos instead.
      if (!source.url.startsWith('data:') && !source.url.startsWith('blob:')) return null;
      blob = await (await fetch(source.url)).blob();
    }
    if (!blob) return null;

    const small = await imageCompression(
      blob instanceof File ? blob : new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }),
      ANALYSIS_COMPRESSION,
    );
    return await fileToDataUri(small);
  } catch {
    // One unreadable photo must not sink the whole request — the caller drops
    // nulls and sends what it has.
    return null;
  }
}

/** Downscale several, keeping only the ones that worked, capped at `max`. */
export async function toModelImages(
  sources: Array<{ url?: string; file?: File | Blob }>,
  max = 3,
): Promise<string[]> {
  const picked = sources.slice(0, max);
  const results = await Promise.all(picked.map(toModelImage));
  return results.filter((d): d is string => !!d);
}
