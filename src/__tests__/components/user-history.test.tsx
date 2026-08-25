import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { subDays, startOfDay } from 'date-fns';
import { UserHistory } from '@/components/admin/analytics/user-history';
import type { FirestoreUser } from '@/lib/types';

// recharts measures its container, which jsdom reports as 0×0 — every chart
// then renders empty and the assertions below would be meaningless. Give
// ResponsiveContainer a real box.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 300 });
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

/**
 * Fixtures carry the `{ seconds, nanoseconds }` shape, not a plain `Date`.
 *
 * That is what `toDate()` in src/lib/types.ts actually accepts — a bare Date
 * has neither `.toDate()` nor `.seconds` and comes back null, so fixtures
 * built from `new Date()` would silently count as "no signup" and every
 * assertion below would pass against an empty chart.
 */
const daysAgo = (n: number) => {
  const d = startOfDay(subDays(new Date(), n));
  return { seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 };
};

function user(over: Partial<FirestoreUser> & { id?: string } = {}): FirestoreUser {
  return {
    id: Math.random().toString(36).slice(2),
    displayName: 'Elira Hoxha',
    email: 'elira@example.com',
    role: 'buyer',
    createdAt: daysAgo(3),
    ...over,
  } as any;
}

describe('UserHistory', () => {
  it('counts only the users who joined inside the selected period', () => {
    // Default period is 30d. The 200-day-old account is part of the baseline,
    // not of "joined in this period".
    render(
      <UserHistory
        users={[user({ createdAt: daysAgo(2) }), user({ createdAt: daysAgo(10) }), user({ createdAt: daysAgo(200) })]}
      />,
    );
    expect(screen.getByText(/2 joined in this period/i)).toBeInTheDocument();
  });

  it('names the busiest day', () => {
    render(
      <UserHistory
        users={[user({ createdAt: daysAgo(5) }), user({ createdAt: daysAgo(5) }), user({ createdAt: daysAgo(1) })]}
      />,
    );
    expect(screen.getByText(/busiest day/i)).toBeInTheDocument();
  });

  it('lists who joined, most recent first', () => {
    render(
      <UserHistory
        users={[
          user({ displayName: 'Older Signup', createdAt: daysAgo(9) }),
          user({ displayName: 'Newest Signup', createdAt: daysAgo(1) }),
        ]}
      />,
    );
    const names = screen.getAllByText(/Signup$/).map((n) => n.textContent);
    expect(names[0]).toBe('Newest Signup');
    expect(names[1]).toBe('Older Signup');
  });

  it('flags accounts that never verified their email', () => {
    render(<UserHistory users={[user({ emailVerified: false } as any)]} />);
    expect(screen.getByText('unverified')).toBeInTheDocument();
  });

  it('shows a non-buyer role as a badge', () => {
    render(<UserHistory users={[user({ role: 'courier' } as any)]} />);
    expect(screen.getByText('courier')).toBeInTheDocument();
  });

  it('says so plainly when nobody joined', () => {
    render(<UserHistory users={[user({ createdAt: daysAgo(300) })]} />);
    expect(screen.getByText(/nobody joined in this period/i)).toBeInTheDocument();
    expect(screen.getByText(/0 joined in this period/i)).toBeInTheDocument();
  });

  it('survives an empty collection and users with no createdAt', () => {
    expect(() => render(<UserHistory users={[]} />)).not.toThrow();
    expect(() =>
      render(<UserHistory users={[user({ createdAt: undefined as any })]} />),
    ).not.toThrow();
  });

  it('renders an unnamed account without crashing on the missing name', () => {
    render(<UserHistory users={[user({ displayName: undefined, name: undefined } as any)]} />);
    expect(screen.getByText('Unnamed')).toBeInTheDocument();
  });
});
