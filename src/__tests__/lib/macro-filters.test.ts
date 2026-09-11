import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = { ...process.env };

async function load() {
  vi.resetModules();
  return import('@/lib/macro-filters');
}

const filter = (id: string, enabled: boolean) => ({
  mapValue: {
    fields: {
      id: { stringValue: id },
      label: { stringValue: id },
      enabled: { booleanValue: enabled },
      productIds: { arrayValue: { values: [] } },
      memberIds: { arrayValue: { values: [] } },
    },
  },
});

describe('macro-filters', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo';
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'key';
    delete process.env.NEXT_PUBLIC_BUILD_TARGET;
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('returns only the enabled chips, in stored order', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      name: 'projects/p/databases/(default)/documents/settings/macro_filters',
      fields: { filters: { arrayValue: { values: [filter('preloved', true), filter('hidden', false), filter('new', true)] } } },
    }), { status: 200 })));
    const { fetchMacroFilters } = await load();
    await expect(fetchMacroFilters()).resolves.toMatchObject([{ id: 'preloved' }, { id: 'new' }]);
  });

  it('yields null on a failed read and skips the native build', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    await expect((await load()).fetchMacroFilters()).resolves.toBeNull();

    process.env.NEXT_PUBLIC_BUILD_TARGET = 'native';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect((await load()).fetchMacroFilters()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
