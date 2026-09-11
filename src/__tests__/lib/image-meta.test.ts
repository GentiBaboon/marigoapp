import { describe, it, expect, vi } from 'vitest';
import { fetchImageFileInfo, formatBytes } from '@/lib/image-meta';

describe('formatBytes', () => {
  it('picks a unit a person would', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(412 * 1024)).toBe('412 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatBytes(12 * 1024 * 1024)).toBe('12 MB');
  });
  it('says unknown rather than NaN', () => {
    expect(formatBytes(null)).toBe('unknown size');
    expect(formatBytes(NaN)).toBe('unknown size');
    expect(formatBytes(-1)).toBe('unknown size');
  });
});

describe('fetchImageFileInfo', () => {
  const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

  it('takes size and type from a HEAD that carries them', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, headers: headers({ 'content-length': '4096', 'content-type': 'image/webp' }) });
    expect(await fetchImageFileInfo('https://x/a.webp', f as any)).toEqual({ bytes: 4096, contentType: 'image/webp' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('falls back to one GET when HEAD has no length', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, headers: headers({ 'content-type': 'image/jpeg' }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => ({ size: 9000, type: 'image/jpeg' }) });
    expect(await fetchImageFileInfo('https://x/a.jpg', f as any)).toEqual({ bytes: 9000, contentType: 'image/jpeg' });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('never throws: a refused host yields unknowns', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('CORS'));
    expect(await fetchImageFileInfo('https://x/a.jpg', f as any)).toEqual({ bytes: null, contentType: null });
  });
});
