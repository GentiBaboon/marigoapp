import { describe, it, expect } from 'vitest';
import {
  classifyDevice,
  isValidSessionId,
  normalizePath,
  referrerHost,
  summarizeSessions,
  PRESENCE_WINDOW_MS,
  type PresenceSession,
} from '@/lib/presence';

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

function session(over: Partial<PresenceSession> = {}): PresenceSession {
  return {
    sessionId: 'a'.repeat(32),
    path: '/home',
    device: 'desktop',
    startedAt: NOW - 60_000,
    lastSeenAt: NOW,
    ...over,
  };
}

describe('isValidSessionId', () => {
  it('accepts a 32-char hex id', () => {
    expect(isValidSessionId('0123456789abcdef0123456789abcdef')).toBe(true);
  });

  it('rejects anything else, because the id becomes part of a Redis key', () => {
    for (const bad of ['', 'short', 'A'.repeat(32), 'g'.repeat(32), 'a'.repeat(31), 'a'.repeat(33),
                       'presence:*', '../../etc', null, undefined, 42, {}]) {
      expect(isValidSessionId(bad as any)).toBe(false);
    }
  });
});

describe('classifyDevice', () => {
  it('spots phones', () => {
    expect(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit')).toBe('mobile');
    expect(classifyDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari')).toBe('mobile');
  });

  it('spots tablets, including Android tablets that omit "Mobile"', () => {
    expect(classifyDevice('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet');
    expect(classifyDevice('Mozilla/5.0 (Linux; Android 13; SM-X200) Safari')).toBe('tablet');
  });

  it('falls back to desktop, including for a missing UA', () => {
    expect(classifyDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('desktop');
    expect(classifyDevice(undefined)).toBe('desktop');
    expect(classifyDevice(null)).toBe('desktop');
  });
});

describe('normalizePath', () => {
  it('keeps a plain path', () => {
    expect(normalizePath('/products/gucci-bag')).toBe('/products/gucci-bag');
  });

  it('drops the query string — it carries search terms and ids that only fragment the grouping', () => {
    expect(normalizePath('/search?q=chanel&color=black')).toBe('/search');
    expect(normalizePath('/home#top')).toBe('/home');
  });

  it('caps the length so a hostile client cannot store an essay', () => {
    expect(normalizePath('/' + 'x'.repeat(500)).length).toBe(120);
  });

  it('refuses anything that is not a site path', () => {
    expect(normalizePath('https://evil.com/x')).toBe('/');
    expect(normalizePath('')).toBe('/');
    expect(normalizePath(null)).toBe('/');
    expect(normalizePath(42)).toBe('/');
  });
});

describe('referrerHost', () => {
  it('keeps only the host — the full URL is somebody else\'s page', () => {
    expect(referrerHost('https://www.google.com/search?q=luxury+bags')).toBe('www.google.com');
  });

  it('is undefined for junk or nothing', () => {
    expect(referrerHost('not a url')).toBeUndefined();
    expect(referrerHost('')).toBeUndefined();
    expect(referrerHost(undefined)).toBeUndefined();
  });
});

describe('summarizeSessions', () => {
  it('counts nobody as nobody', () => {
    const s = summarizeSessions([], NOW);
    expect(s.online).toBe(0);
    expect(s.byPath).toEqual([]);
  });

  it('drops sessions past the live window', () => {
    const s = summarizeSessions(
      [session(), session({ sessionId: 'b'.repeat(32), lastSeenAt: NOW - PRESENCE_WINDOW_MS - 1 })],
      NOW,
    );
    expect(s.online).toBe(1);
  });

  it('keeps a session exactly on the window boundary', () => {
    // One dropped heartbeat must not blink a real visitor off the dashboard.
    const s = summarizeSessions([session({ lastSeenAt: NOW - PRESENCE_WINDOW_MS })], NOW);
    expect(s.online).toBe(1);
  });

  it('splits signed-in from anonymous', () => {
    const s = summarizeSessions(
      [
        session({ uid: 'u1', name: 'Elira' }),
        session({ sessionId: 'b'.repeat(32) }),
        session({ sessionId: 'c'.repeat(32) }),
      ],
      NOW,
    );
    expect(s.signedIn).toBe(1);
    expect(s.anonymous).toBe(2);
    expect(s.online).toBe(3);
  });

  it('ranks pages by how busy they are', () => {
    const s = summarizeSessions(
      [
        session({ sessionId: 'a'.repeat(32), path: '/search' }),
        session({ sessionId: 'b'.repeat(32), path: '/search' }),
        session({ sessionId: 'c'.repeat(32), path: '/home' }),
      ],
      NOW,
    );
    expect(s.byPath[0]).toEqual({ path: '/search', count: 2 });
    expect(s.byPath[1]).toEqual({ path: '/home', count: 1 });
  });

  it('counts devices', () => {
    const s = summarizeSessions(
      [
        session({ sessionId: 'a'.repeat(32), device: 'mobile' }),
        session({ sessionId: 'b'.repeat(32), device: 'mobile' }),
        session({ sessionId: 'c'.repeat(32), device: 'desktop' }),
      ],
      NOW,
    );
    expect(s.byDevice).toEqual({ mobile: 2, tablet: 0, desktop: 1 });
  });

  it('orders sessions longest-running first', () => {
    const s = summarizeSessions(
      [
        session({ sessionId: 'a'.repeat(32), startedAt: NOW - 10_000 }),
        session({ sessionId: 'b'.repeat(32), startedAt: NOW - 600_000 }),
      ],
      NOW,
    );
    expect(s.sessions[0].sessionId).toBe('b'.repeat(32));
  });
});
