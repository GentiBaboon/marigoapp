import { describe, it, expect } from 'vitest';
import { shouldCountView, viewCountKey, VIEW_COUNT_INTERVAL_MS } from '@/lib/view-throttle';

const NOW = Date.UTC(2026, 8, 14, 12, 0, 0);

describe('shouldCountView', () => {
  it('counts a listing this browser has never opened', () => {
    expect(shouldCountView(null, NOW)).toBe(true);
    expect(shouldCountView(undefined, NOW)).toBe(true);
  });

  // The behaviour that changed: the old sessionStorage flag was permanent, so
  // the same shopper returning to a listing never counted again.
  it('counts the same shopper again once the hour is up', () => {
    expect(shouldCountView(NOW - VIEW_COUNT_INTERVAL_MS, NOW)).toBe(true);
    expect(shouldCountView(NOW - VIEW_COUNT_INTERVAL_MS - 1, NOW)).toBe(true);
    expect(shouldCountView(NOW - 25 * 60 * 60 * 1000, NOW)).toBe(true);
  });

  it('does not count a refresh or a back-and-forward inside the hour', () => {
    expect(shouldCountView(NOW, NOW)).toBe(false);
    expect(shouldCountView(NOW - 1000, NOW)).toBe(false);
    expect(shouldCountView(NOW - VIEW_COUNT_INTERVAL_MS + 1, NOW)).toBe(false);
  });

  it('reads a stored string, which is what localStorage hands back', () => {
    expect(shouldCountView(String(NOW - 1000), NOW)).toBe(false);
    expect(shouldCountView(String(NOW - VIEW_COUNT_INTERVAL_MS), NOW)).toBe(true);
  });

  // Fails towards counting: one extra view is a better outcome than a
  // listing whose counter is stuck because of junk left by an older build.
  it('treats an unreadable value as never seen', () => {
    expect(shouldCountView('', NOW)).toBe(true);
    expect(shouldCountView('1', NOW - 1)).toBe(true);
    expect(shouldCountView('not-a-number', NOW)).toBe(true);
    expect(shouldCountView(NaN, NOW)).toBe(true);
    expect(shouldCountView(0, NOW)).toBe(true);
    expect(shouldCountView(-1, NOW)).toBe(true);
  });

  // A clock that was wrong when the value was written must not freeze the
  // counter until the future timestamp passes.
  it('treats a future timestamp as never seen', () => {
    expect(shouldCountView(NOW + 60_000, NOW)).toBe(true);
    expect(shouldCountView(NOW + 10 * VIEW_COUNT_INTERVAL_MS, NOW)).toBe(true);
  });

  it('is an hour', () => {
    expect(VIEW_COUNT_INTERVAL_MS).toBe(3_600_000);
  });
});

describe('viewCountKey', () => {
  // Distinct from the old `marigo_viewed_` sessionStorage flag, so the first
  // view after this shipped counts rather than inheriting a permanent block.
  it('is per product and does not collide with the old session flag', () => {
    expect(viewCountKey('abc')).toBe('marigo_view_counted_abc');
    expect(viewCountKey('abc')).not.toBe(viewCountKey('abd'));
    expect(viewCountKey('abc').startsWith('marigo_viewed_')).toBe(false);
  });
});
