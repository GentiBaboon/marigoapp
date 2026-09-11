import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = { ...process.env };

async function load() {
  vi.resetModules();
  return import('@/lib/homepage-blocks');
}

function restDoc(blocks: unknown) {
  return {
    name: 'projects/p/databases/(default)/documents/settings/homepage_blocks',
    fields: { blocks: { arrayValue: { values: blocks as any[] } } },
  };
}

const block = (id: string, extra: Record<string, unknown> = {}) => ({
  mapValue: {
    fields: {
      id: { stringValue: id },
      url: { stringValue: `/search?q=${id}` },
      visible: { booleanValue: true },
      order: { integerValue: '1' },
      ...Object.fromEntries(
        Object.entries(extra).map(([k, v]) => [
          k,
          typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v },
        ]),
      ),
    },
  },
});

describe('homepage-blocks', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo';
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'key';
    delete process.env.NEXT_PUBLIC_BUILD_TARGET;
  });

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('keeps only visible blocks, in admin order', async () => {
    const { visibleBlocks } = await load();
    const out = visibleBlocks([
      { id: 'b', url: '', visible: true, order: 2 },
      { id: 'hidden', url: '', visible: false, order: 0 },
      { id: 'a', url: '', visible: true, order: 1 },
    ]);
    expect(out.map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('reads the new images array or the legacy single image', async () => {
    const { blockImages } = await load();
    expect(blockImages({ id: 'x', url: '', visible: true, order: 0, images: [{ url: 'a', x: 1, y: 2 }, { url: '', x: 0, y: 0 }] }))
      .toEqual([{ url: 'a', x: 1, y: 2 }]);
    expect(blockImages({ id: 'x', url: '', visible: true, order: 0, imageUrl: 'legacy' }))
      .toEqual([{ url: 'legacy', x: 50, y: 50 }]);
    expect(blockImages({ id: 'x', url: '', visible: true, order: 0 })).toEqual([]);
  });

  it('fetches the document over REST and returns the visible blocks', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(restDoc([
      block('second', { order: 2 }),
      block('off', { visible: false }),
      block('first', { order: 1, title: 'New pieces' }),
    ])), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchHomepageBlocks } = await load();

    const blocks = await fetchHomepageBlocks();
    expect(blocks?.map((b) => b.id)).toEqual(['first', 'second']);
    expect(blocks?.[0].title).toBe('New pieces');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { next?: { revalidate?: number } }];
    expect(url).toContain('/documents/settings/homepage_blocks?key=key');
    // The server copy is cached and refreshed, never re-read per request.
    expect(init.next?.revalidate).toBeGreaterThan(0);
  });

  it('never throws: a failed read yields null so the browser fills in', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fetchHomepageBlocks } = await load();
    await expect(fetchHomepageBlocks()).resolves.toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const mod = await load();
    await expect(mod.fetchHomepageBlocks()).resolves.toBeNull();
  });

  it('is skipped in the native build, whose pages are exported once', async () => {
    process.env.NEXT_PUBLIC_BUILD_TARGET = 'native';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { fetchHomepageBlocks } = await load();
    await expect(fetchHomepageBlocks()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is skipped without Firestore config (CI placeholder env)', async () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { fetchHomepageBlocks } = await load();
    await expect(fetchHomepageBlocks()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
