import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

/**
 * The catalog cache sits in front of ~588 documents of reference data that
 * every shopper-facing page reads. If it over-fetches, the saving disappears;
 * if it under-fetches, pickers and filters render empty. Both failure modes are
 * silent, so they are covered here.
 */

const getDocsMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ __name: name }),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
}));

const snapshotOf = (ids: string[]) => ({
  docs: ids.map(id => ({ id, data: () => ({ name: id.toUpperCase() }) })),
});

const db = {} as any;

async function freshModule() {
  vi.resetModules();
  return import('@/lib/catalog-cache');
}

beforeEach(() => {
  getDocsMock.mockReset();
  sessionStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadCatalogCollection', () => {
  it('fetches once and serves later calls from cache', async () => {
    const { loadCatalogCollection } = await freshModule();
    getDocsMock.mockResolvedValue(snapshotOf(['a', 'b', 'c']));

    const first = await loadCatalogCollection(db, 'brands');
    const second = await loadCatalogCollection(db, 'brands');

    expect(first).toHaveLength(3);
    expect(second).toEqual(first);
    // The whole point: the second read costs nothing.
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('de-dupes concurrent first loads', async () => {
    const { loadCatalogCollection } = await freshModule();
    getDocsMock.mockResolvedValue(snapshotOf(['a']));

    // Several components mounting in the same tick must not each fetch —
    // this is exactly what /search used to do with brands and categories.
    const [x, y, z] = await Promise.all([
      loadCatalogCollection(db, 'categories'),
      loadCatalogCollection(db, 'categories'),
      loadCatalogCollection(db, 'categories'),
    ]);

    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(x).toEqual(y);
    expect(y).toEqual(z);
  });

  it('keeps separate caches per collection', async () => {
    const { loadCatalogCollection } = await freshModule();
    getDocsMock
      .mockResolvedValueOnce(snapshotOf(['brand-1']))
      .mockResolvedValueOnce(snapshotOf(['colour-1', 'colour-2']));

    const brands = await loadCatalogCollection(db, 'brands');
    const colors = await loadCatalogCollection(db, 'colors');

    expect(brands.map(b => b.id)).toEqual(['brand-1']);
    expect(colors.map(c => c.id)).toEqual(['colour-1', 'colour-2']);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('survives a page reload via sessionStorage', async () => {
    const first = await freshModule();
    getDocsMock.mockResolvedValue(snapshotOf(['a', 'b']));
    await first.loadCatalogCollection(db, 'materials');
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    // New module instance = fresh in-memory cache, as after a reload.
    const second = await freshModule();
    const docs = await second.loadCatalogCollection(db, 'materials');

    expect(docs).toHaveLength(2);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('re-fetches once the entry is older than the TTL', async () => {
    const { loadCatalogCollection } = await freshModule();
    getDocsMock.mockResolvedValue(snapshotOf(['a']));

    await loadCatalogCollection(db, 'patterns');
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    // 31 minutes on: past the 30-minute TTL.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60 * 1000);
    await loadCatalogCollection(db, 'patterns');
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('serves a stale copy when the network fails, rather than nothing', async () => {
    const { loadCatalogCollection } = await freshModule();
    getDocsMock.mockResolvedValueOnce(snapshotOf(['a', 'b']));
    await loadCatalogCollection(db, 'conditions');

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60 * 1000);
    getDocsMock.mockRejectedValueOnce(new Error('offline'));

    // An expired list of conditions still beats an empty picker.
    const docs = await loadCatalogCollection(db, 'conditions');
    expect(docs).toHaveLength(2);
  });

  it('returns empty rather than throwing when there is nothing to fall back on', async () => {
    const { loadCatalogCollection } = await freshModule();
    getDocsMock.mockRejectedValue(new Error('offline'));

    await expect(loadCatalogCollection(db, 'size_charts')).resolves.toEqual([]);
  });
});

describe('invalidateCatalog', () => {
  it('forces the next read to hit Firestore again', async () => {
    const { loadCatalogCollection, invalidateCatalog } = await freshModule();
    getDocsMock.mockResolvedValue(snapshotOf(['a']));

    await loadCatalogCollection(db, 'brands');
    invalidateCatalog('brands');
    await loadCatalogCollection(db, 'brands');

    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('clears every collection when called with no argument', async () => {
    const { loadCatalogCollection, invalidateCatalog } = await freshModule();
    getDocsMock.mockResolvedValue(snapshotOf(['a']));

    await loadCatalogCollection(db, 'brands');
    await loadCatalogCollection(db, 'colors');
    expect(getDocsMock).toHaveBeenCalledTimes(2);

    invalidateCatalog();
    await loadCatalogCollection(db, 'brands');
    await loadCatalogCollection(db, 'colors');

    expect(getDocsMock).toHaveBeenCalledTimes(4);
  });
});
