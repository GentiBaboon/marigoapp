import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/firebase', () => ({
  useAuth: () => ({ currentUser: { getIdToken: async () => 'test-token' } }),
}));

import { LiveVisitors } from '@/components/admin/analytics/live-visitors';
import type { PresenceSummary } from '@/lib/presence';

const NOW = Date.now();

function summary(over: Partial<PresenceSummary> = {}): PresenceSummary {
  return {
    online: 3,
    signedIn: 1,
    anonymous: 2,
    byPath: [
      { path: '/search', count: 2 },
      { path: '/home', count: 1 },
    ],
    byDevice: { mobile: 2, tablet: 0, desktop: 1 },
    sessions: [
      { sessionId: 'a'.repeat(32), uid: 'u1', name: 'Elira', path: '/search', device: 'desktop', startedAt: NOW - 300_000, lastSeenAt: NOW },
      { sessionId: 'b'.repeat(32), path: '/home', device: 'mobile', startedAt: NOW - 20_000, lastSeenAt: NOW },
    ],
    ...over,
  };
}

const respondWith = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body });

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LiveVisitors', () => {
  it('shows the live counts', async () => {
    vi.stubGlobal('fetch', respondWith({ configured: true, summary: summary() }));
    render(<LiveVisitors />);
    await waitFor(() => expect(screen.getByText('Online now')).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Browsing signed out')).toBeInTheDocument();
  });

  it('sends the admin token — this endpoint exposes every visitor location', async () => {
    const fetchMock = respondWith({ configured: true, summary: summary() });
    vi.stubGlobal('fetch', fetchMock);
    render(<LiveVisitors />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as any).Authorization).toBe('Bearer test-token');
  });

  it('ranks the busiest pages', async () => {
    vi.stubGlobal('fetch', respondWith({ configured: true, summary: summary() }));
    render(<LiveVisitors />);
    // A path shows up twice on purpose — once in the busiest-pages ranking and
    // once beside the session that is on it — so this matches all of them and
    // asserts on the ranking list specifically.
    await waitFor(() => expect(screen.getAllByRole('list').length).toBe(2));
    // First list is the busiest-pages ranking, second is the session list.
    const ranking = screen.getAllByRole('list')[0].textContent ?? '';
    expect(ranking).toContain('/search');
    expect(ranking).toContain('/home');
    // Busiest first: /search (2) must be ranked above /home (1).
    expect(ranking.indexOf('/search')).toBeLessThan(ranking.indexOf('/home'));
  });

  it('names signed-in visitors and marks the rest anonymous', async () => {
    vi.stubGlobal('fetch', respondWith({ configured: true, summary: summary() }));
    render(<LiveVisitors />);
    await waitFor(() => expect(screen.getByText('Elira')).toBeInTheDocument());
    expect(screen.getByText('Signed-out visitor')).toBeInTheDocument();
  });

  it('explains how to switch it on when Upstash is absent', async () => {
    // The state every deployment starts in — it must read as setup, not breakage.
    vi.stubGlobal('fetch', respondWith({ configured: false, summary: null }));
    render(<LiveVisitors />);
    await waitFor(() => expect(screen.getByText('Not configured')).toBeInTheDocument());
    expect(screen.getByText(/UPSTASH_REDIS_REST_URL/)).toBeInTheDocument();
  });

  it('says nobody is here rather than rendering an empty list', async () => {
    vi.stubGlobal('fetch', respondWith({
      configured: true,
      summary: summary({ online: 0, signedIn: 0, anonymous: 0, byPath: [], sessions: [] }),
    }));
    render(<LiveVisitors />);
    await waitFor(() => expect(screen.getByText(/nobody on the site right now/i)).toBeInTheDocument());
  });

  it('keeps the last good reading when a poll fails', async () => {
    // One dropped poll is not the same as the site emptying out.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true, summary: summary() }) })
      .mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);
    render(<LiveVisitors />);
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());

    await vi.advanceTimersByTimeAsync(16_000);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    // Still showing 3, now flagged as reconnecting.
    expect(screen.getByText('3')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/reconnecting/i)).toBeInTheDocument(),
    );
  });

  it('polls again on a timer rather than reading once', async () => {
    const fetchMock = respondWith({ configured: true, summary: summary() });
    vi.stubGlobal('fetch', fetchMock);
    render(<LiveVisitors />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(31_000);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3));
  });
});
