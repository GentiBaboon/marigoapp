/**
 * What an admin wants to know about a listing photo before approving it:
 * how big the file really is, and what the pixels really are. The grid
 * shows a 150px optimised thumbnail, which hides both.
 */

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return 'unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export interface ImageFileInfo {
  bytes: number | null;
  contentType: string | null;
}

/**
 * Size and type from the storage host, without downloading the file when a
 * HEAD answers. Supabase public storage sends `content-length` and CORS
 * headers on HEAD; a host that refuses gets one GET and the blob's size.
 * Anything else resolves to unknowns rather than throwing — the dialog is
 * still useful without the numbers.
 */
export async function fetchImageFileInfo(url: string, fetcher: typeof fetch = fetch): Promise<ImageFileInfo> {
  try {
    const head = await fetcher(url, { method: 'HEAD' });
    const len = Number(head.headers.get('content-length'));
    const type = head.headers.get('content-type');
    if (head.ok && Number.isFinite(len) && len > 0) return { bytes: len, contentType: type };
    const res = await fetcher(url);
    if (!res.ok) return { bytes: null, contentType: type };
    const blob = await res.blob();
    return { bytes: blob.size, contentType: blob.type || type };
  } catch {
    return { bytes: null, contentType: null };
  }
}
