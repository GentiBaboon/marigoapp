'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/firebase';
import { getCookie } from '@/lib/cookies';
import { PRESENCE_HEARTBEAT_MS } from '@/lib/presence';

const SESSION_KEY = 'marigo_presence_session';
const STARTED_KEY = 'marigo_presence_started';

/**
 * Session identity.
 *
 * `sessionStorage`, not `localStorage`: a session should mean "this tab, this
 * visit". A persisted id would make one returning shopper look like a visitor
 * who has been online for weeks, and it would follow them across visits, which
 * is tracking rather than presence.
 */
function sessionIdentity(): { sessionId: string; startedAt: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId || !/^[0-9a-f]{32}$/.test(sessionId)) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      sessionId = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem(SESSION_KEY, sessionId);
      sessionStorage.setItem(STARTED_KEY, String(Date.now()));
    }
    const startedAt = Number(sessionStorage.getItem(STARTED_KEY)) || Date.now();
    return { sessionId, startedAt };
  } catch {
    // Private mode, or storage disabled. No id means no heartbeat, which is
    // the right outcome — presence must never be the thing that breaks a page.
    return null;
  }
}


/**
 * Headers for one beat.
 *
 * The CSRF token is the load-bearing part. Middleware exempts Bearer-carrying
 * requests, and a *signed-out* visitor has no Bearer token — which is exactly
 * the visitor this feature exists to count. Without the double-submit header
 * every anonymous heartbeat is rejected 403 and the live view only ever shows
 * signed-in users. `__csrf` is deliberately not httpOnly so JS can echo it
 * back; see src/middleware.ts.
 */
function beatHeaders(token?: string | null): HeadersInit {
  const csrf = getCookie('__csrf');
  return {
    'Content-Type': 'application/json',
    ...(csrf ? { 'x-csrf-token': csrf } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Beat once on mount, once per route change, and every 45s thereafter.
 *
 * Mounted from the root layout, so it covers anonymous shoppers as well as
 * signed-in ones — the whole point, since most people browse signed out.
 *
 * Two things keep this from being a tax on every visitor:
 *
 * - **Backgrounded tabs stop beating.** A tab left open behind others would
 *   otherwise report as a live visitor indefinitely and cost a write every 45s
 *   to say so. The interval is torn down on `visibilitychange` and a beat
 *   fires immediately on return, so a real visitor reappears at once.
 * - **Failures are silent and unretried.** This is telemetry; a dropped beat
 *   costs one dot on a dashboard, and retry storms cost real money.
 */
export function usePresence(): void {
  const pathname = usePathname();
  const auth = useAuth();
  // Kept in a ref so the heartbeat interval never re-registers on navigation —
  // resetting a 45s timer on every route change would make a browsing visitor
  // beat far more often than one sitting still.
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const identity = sessionIdentity();
    if (!identity) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        // The token is optional: a signed-out visitor is exactly who this is
        // counting, so an absent one is not a failure.
        const token = await auth?.currentUser?.getIdToken().catch(() => null);
        await fetch('/api/presence', {
          method: 'POST',
          headers: beatHeaders(token),
          body: JSON.stringify({
            sessionId: identity.sessionId,
            startedAt: identity.startedAt,
            path: pathRef.current,
            referrer: document.referrer || undefined,
          }),
          // The tab may close mid-beat; there is nothing to keep alive for.
          keepalive: true,
        });
      } catch {
        /* telemetry — never surfaced, never retried */
      }
    };

    const start = () => {
      if (timer) return;
      void beat();
      timer = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // `auth` is a stable SDK instance; pathname is read through the ref above.
  }, [auth]);

  // A route change beats immediately so the live view tracks navigation,
  // without disturbing the interval.
  useEffect(() => {
    const identity = sessionIdentity();
    if (!identity || document.visibilityState !== 'visible') return;
    const token = auth?.currentUser?.getIdToken?.();
    void Promise.resolve(token)
      .catch(() => null)
      .then((t) =>
        fetch('/api/presence', {
          method: 'POST',
          headers: beatHeaders(t),
          body: JSON.stringify({
            sessionId: identity.sessionId,
            startedAt: identity.startedAt,
            path: pathname,
            referrer: document.referrer || undefined,
          }),
          keepalive: true,
        }).catch(() => undefined),
      );
  }, [pathname, auth]);
}
