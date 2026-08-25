/**
 * Live visitor presence, backed by Upstash Redis over its REST API.
 *
 * ## Why not Firestore
 *
 * Presence is the opposite of everything Firestore is good at: it is written
 * constantly, read rarely, worthless within ninety seconds, and needs no
 * history. Two harder problems rule Firestore out here:
 *
 * 1. **There would be no safe way to write it.** Most shoppers browse signed
 *    out, and this app has no service-account key (CLAUDE.md §6) — a server
 *    route reaches Firestore with the *caller's* token, so it cannot write on
 *    an anonymous visitor's behalf either. Tracking them would mean opening an
 *    unauthenticated Firestore write path, which is an unmetered cost attack.
 *    Here the browser talks only to `/api/presence`, which is IP rate-limited,
 *    and the Upstash credential never leaves the server.
 * 2. **Expiry.** Redis keys carry a TTL, so a visitor who closes the tab
 *    disappears on their own. The Firestore equivalent needs a scheduled job
 *    to sweep stale documents — more infrastructure to run and get wrong.
 *
 * ## What is stored
 *
 * Deliberately not IP addresses and not raw user-agent strings: a coarse
 * device class is all a live dashboard needs, and the rest is personal data
 * with no operational use. Signed-in visitors carry a uid and display name so
 * an operator can tell who is on the site; anonymous ones are an opaque random
 * id that dies with the tab.
 *
 * Everything decidable without I/O is a pure function here, so it can be
 * tested without a Redis.
 */

/** A session counts as online if its heartbeat landed within this window.
 *  Two heartbeat intervals, so one dropped beat does not blink a real visitor
 *  off the dashboard. */
export const PRESENCE_WINDOW_MS = 90_000;

/** How often the browser beats. Long enough to be cheap, short enough that the
 *  dashboard feels live. */
export const PRESENCE_HEARTBEAT_MS = 45_000;

/** Key TTL. Comfortably longer than the window so the sorted-set index and the
 *  blobs never disagree about who is here. */
const KEY_TTL_SECONDS = 150;

const INDEX_KEY = 'presence:index';
const keyFor = (sessionId: string) => `presence:${sessionId}`;

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';

export interface PresenceSession {
  sessionId: string;
  /** Present only for signed-in visitors. */
  uid?: string;
  name?: string;
  /** Current page. Truncated — a path is for grouping, not for forensics. */
  path: string;
  device: DeviceClass;
  /** Where they entered the site from, host only. */
  referrerHost?: string;
  startedAt: number;
  lastSeenAt: number;
}

export interface PresenceSummary {
  online: number;
  signedIn: number;
  anonymous: number;
  byPath: Array<{ path: string; count: number }>;
  byDevice: Record<DeviceClass, number>;
  /** Longest-running sessions first — who is actually engaged, not just open. */
  sessions: PresenceSession[];
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Session ids are minted in the browser, so they are untrusted input: pin the
 *  shape before it is ever used to build a Redis key. */
export function isValidSessionId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{32}$/.test(id);
}

/** Coarse device class from a user-agent. The UA itself is never stored. */
export function classifyDevice(userAgent: string | null | undefined): DeviceClass {
  const ua = (userAgent ?? '').toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Normalise a reported path.
 *
 * Query strings are dropped: they carry search terms and ids that are of no
 * use grouped, and every distinct one would fragment the page list. Length is
 * capped so a hostile client cannot store an essay.
 */
export function normalizePath(path: unknown): string {
  if (typeof path !== 'string' || !path.startsWith('/')) return '/';
  return path.split(/[?#]/)[0].slice(0, 120) || '/';
}

/** Host only — the full referrer URL is somebody else's page, not ours. */
export function referrerHost(referrer: unknown): string | undefined {
  if (typeof referrer !== 'string' || !referrer) return undefined;
  try {
    return new URL(referrer).host.slice(0, 80) || undefined;
  } catch {
    return undefined;
  }
}

/** Aggregate live sessions into what the dashboard renders. */
export function summarizeSessions(
  sessions: PresenceSession[],
  now = Date.now(),
): PresenceSummary {
  const live = sessions.filter((s) => now - s.lastSeenAt <= PRESENCE_WINDOW_MS);
  const paths = new Map<string, number>();
  const byDevice: Record<DeviceClass, number> = { mobile: 0, tablet: 0, desktop: 0 };

  for (const s of live) {
    paths.set(s.path, (paths.get(s.path) ?? 0) + 1);
    byDevice[s.device] = (byDevice[s.device] ?? 0) + 1;
  }

  return {
    online: live.length,
    signedIn: live.filter((s) => !!s.uid).length,
    anonymous: live.filter((s) => !s.uid).length,
    byPath: [...paths.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)),
    byDevice,
    sessions: [...live].sort((a, b) => a.startedAt - b.startedAt),
  };
}

// ── Upstash transport ───────────────────────────────────────────────────────

/**
 * Configured?
 *
 * A function, never a module-scope read: this module is imported during
 * `next build` page-data collection and CI runs on placeholder env, so
 * anything evaluated at import time has to hold for a build with no
 * credentials at all (CLAUDE.md §11).
 */
export function isPresenceConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/** Run a pipeline of Redis commands. Resolves rather than throwing — presence
 *  is telemetry, and losing a heartbeat must never fail the page that sent it. */
async function pipeline(commands: unknown[][]): Promise<{ ok: boolean; results: any[] }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { ok: false, results: [] };

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`[presence] upstash ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return { ok: false, results: [] };
    }
    const body = await res.json();
    return { ok: true, results: Array.isArray(body) ? body.map((r: any) => r?.result) : [] };
  } catch (err: any) {
    console.error('[presence] upstash unreachable:', err?.message ?? err);
    return { ok: false, results: [] };
  }
}

/** Record one heartbeat: the session blob, plus its place in the time index. */
export async function recordHeartbeat(session: PresenceSession): Promise<boolean> {
  const { ok } = await pipeline([
    ['SET', keyFor(session.sessionId), JSON.stringify(session), 'EX', String(KEY_TTL_SECONDS)],
    ['ZADD', INDEX_KEY, String(session.lastSeenAt), session.sessionId],
    // The index is the one key with no natural TTL — without this it would
    // outlive every session it points at and grow without bound.
    ['EXPIRE', INDEX_KEY, String(KEY_TTL_SECONDS * 4)],
  ]);
  return ok;
}

/** Read whoever is currently on the site, pruning the index as it goes. */
export async function readLiveSessions(now = Date.now()): Promise<PresenceSession[]> {
  const cutoff = now - PRESENCE_WINDOW_MS;

  const { ok, results } = await pipeline([
    // Prune before reading, so the index cannot accumulate ids whose blobs
    // have already expired out from under it.
    ['ZREMRANGEBYSCORE', INDEX_KEY, '-inf', String(cutoff)],
    ['ZRANGE', INDEX_KEY, String(cutoff), '+inf', 'BYSCORE'],
  ]);
  if (!ok) return [];

  const ids: string[] = (results[1] ?? []).filter(isValidSessionId);
  if (!ids.length) return [];

  const { ok: readOk, results: blobs } = await pipeline([['MGET', ...ids.map(keyFor)]]);
  if (!readOk) return [];

  return ((blobs[0] ?? []) as Array<string | null>)
    .map((raw) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw) as PresenceSession;
      } catch {
        return null;
      }
    })
    .filter((s): s is PresenceSession => !!s && isValidSessionId(s.sessionId));
}
