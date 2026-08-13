import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagedList, useInfiniteScroll, PAGE_STEP } from '@/hooks/use-infinite-scroll';

const items = (n: number) => Array.from({ length: n }, (_, i) => `item-${i}`);

describe('usePagedList', () => {
  it('shows the first page and reports more to come', () => {
    const { result } = renderHook(() => usePagedList(items(24)));

    expect(result.current.visible).toHaveLength(PAGE_STEP);
    expect(result.current.visible[0]).toBe('item-0');
    expect(result.current.hasMore).toBe(true);
    expect(result.current.total).toBe(24);
  });

  it('reveals exactly one page per call', () => {
    const { result } = renderHook(() => usePagedList(items(24)));

    act(() => result.current.loadMore());
    expect(result.current.visible).toHaveLength(20);

    act(() => result.current.loadMore());
    // Clamped to the real length, not 30.
    expect(result.current.visible).toHaveLength(24);
    expect(result.current.hasMore).toBe(false);
  });

  it('stays idle for a list that fits on one page', () => {
    // The brief only asks for pagination past ten items; a short list should
    // render whole with no affordance at all.
    const { result } = renderHook(() => usePagedList(items(8)));

    expect(result.current.visible).toHaveLength(8);
    expect(result.current.hasMore).toBe(false);
  });

  it('handles exactly one full page', () => {
    const { result } = renderHook(() => usePagedList(items(10)));
    expect(result.current.visible).toHaveLength(10);
    expect(result.current.hasMore).toBe(false);
  });

  it('tolerates null and undefined while data loads', () => {
    const { result: nullResult } = renderHook(() => usePagedList(null));
    expect(nullResult.current.visible).toEqual([]);
    expect(nullResult.current.hasMore).toBe(false);

    const { result: undefResult } = renderHook(() => usePagedList(undefined));
    expect(undefResult.current.visible).toEqual([]);
  });

  it('resets to the first page when the list changes', () => {
    // Applying a filter must not leave the visitor scrolled deep into results
    // that no longer exist.
    const { result, rerender } = renderHook(({ list }) => usePagedList(list), {
      initialProps: { list: items(30) },
    });

    act(() => result.current.loadMore());
    expect(result.current.visible).toHaveLength(20);

    rerender({ list: items(15) });
    expect(result.current.visible).toHaveLength(PAGE_STEP);
  });

  it('honours a custom step', () => {
    const { result } = renderHook(() => usePagedList(items(30), 5));
    expect(result.current.visible).toHaveLength(5);
    act(() => result.current.loadMore());
    expect(result.current.visible).toHaveLength(10);
  });
});

describe('useInfiniteScroll', () => {
  let observed: Element[];
  let trigger: (entries: Partial<IntersectionObserverEntry>[]) => void;
  let disconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    observed = [];
    disconnect = vi.fn();
    // Minimal IntersectionObserver stand-in that lets a test fire an intersection.
    (globalThis as any).IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) {
        trigger = (entries) => cb(entries as IntersectionObserverEntry[], this as any);
      }
      observe(el: Element) { observed.push(el); }
      disconnect() { disconnect(); }
      unobserve() {}
takeRecords() { return []; }
      root = null; rootMargin = ''; thresholds = [];
    };
  });

  afterEach(() => {
    delete (globalThis as any).IntersectionObserver;
  });

  it('does not observe until the sentinel element exists', () => {
    const onLoadMore = vi.fn();
    renderHook(() => useInfiniteScroll({ hasMore: true, onLoadMore }));

    // No node attached yet — this is the state that silently broke the first
    // implementation, which read a null ref once and never retried.
    expect(observed).toHaveLength(0);
  });

  it('observes once the sentinel mounts, and loads when it intersects', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll({ hasMore: true, onLoadMore }));

    const el = document.createElement('div');
    act(() => result.current.sentinelRef(el));

    expect(observed).toContain(el);

    act(() => trigger([{ isIntersecting: true }]));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('ignores a non-intersecting entry', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll({ hasMore: true, onLoadMore }));
    act(() => result.current.sentinelRef(document.createElement('div')));

    act(() => trigger([{ isIntersecting: false }]));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not observe when there is nothing more to load', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll({ hasMore: false, onLoadMore }));
    act(() => result.current.sentinelRef(document.createElement('div')));

    expect(observed).toHaveLength(0);
  });

  it('does not stack requests while one is in flight', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ hasMore: true, isLoading: true, onLoadMore }));
    act(() => result.current.sentinelRef(document.createElement('div')));

    expect(observed).toHaveLength(0);
  });
});
