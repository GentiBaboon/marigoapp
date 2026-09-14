/**
 * How often one browser may add to a listing's public view count.
 *
 * The counter answers "how many times has this listing been opened", so a
 * repeat visit by the same shopper *is* a view and must count — what it must
 * not count is a refresh, a back-and-forward, or the same tab reopened a
 * minute later. An hour is the window: long enough that working through one
 * page reads as a single view, short enough that coming back later in the day
 * is counted again.
 *
 * Before this the guard was a permanent `sessionStorage` flag, so the second
 * and every later view by the same shopper was silently dropped.
 */
export const VIEW_COUNT_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Whether this view should bump the counter, given when this browser last
 * counted one for the same listing.
 *
 * Pure, so the window is testable without a browser — the caller owns storage.
 * `lastCountedAt` is whatever came back out of it: a missing key, a number, or
 * junk left by an older build. Anything unreadable counts as "never seen",
 * which is the safe direction to fail — at worst one extra view.
 *
 * A timestamp in the future is treated the same way, so a machine whose clock
 * was wrong when the value was written cannot freeze the counter forever.
 */
export function shouldCountView(
  lastCountedAt: string | number | null | undefined,
  now: number = Date.now(),
): boolean {
  const last = typeof lastCountedAt === 'number' ? lastCountedAt : Number(lastCountedAt);
  if (!Number.isFinite(last) || last <= 0) return true;
  if (last > now) return true;
  return now - last >= VIEW_COUNT_INTERVAL_MS;
}

/** localStorage key holding when this browser last counted a view of `productId`. */
export function viewCountKey(productId: string): string {
  return `marigo_view_counted_${productId}`;
}

// localStorage is the real store: the window has to outlive the tab, or "once
// an hour" quietly degrades into "once per tab". The in-memory map is the
// fallback for browsers that refuse storage outright (private mode, site data
// blocked) — those still throttle for as long as the page is open, rather than
// counting a view on every navigation.
const memoryFallback = new Map<string, number>();

export function readLastCountedAt(productId: string): number | null {
  const key = viewCountKey(productId);
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return Number(stored);
  } catch {
    // Storage unavailable — fall through to the in-memory copy.
  }
  return memoryFallback.get(key) ?? null;
}

export function markViewCounted(productId: string, now: number = Date.now()): void {
  const key = viewCountKey(productId);
  memoryFallback.set(key, now);
  try {
    window.localStorage.setItem(key, String(now));
  } catch {
    // Storage unavailable — the in-memory copy above is the throttle.
  }
}
