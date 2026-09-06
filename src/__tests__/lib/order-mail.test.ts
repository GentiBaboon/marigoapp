import { describe, it, expect } from 'vitest';
import { isOrderMailStatus, alreadyMailed, withMailed, mailedStatuses } from '@/lib/order-mail';

describe('isOrderMailStatus', () => {
  it('accepts only the three statuses the buyer is mailed about', () => {
    expect(isOrderMailStatus('shipped')).toBe(true);
    expect(isOrderMailStatus('completed')).toBe(true);
    expect(isOrderMailStatus('cancelled')).toBe(true);
    // Intermediate seller steps and requests are in-app only.
    expect(isOrderMailStatus('in_preparation')).toBe(false);
    expect(isOrderMailStatus('cancel_requested')).toBe(false);
    expect(isOrderMailStatus(undefined)).toBe(false);
  });
});

describe('mailed bookkeeping', () => {
  it('reads nothing from a fresh order', () => {
    expect(mailedStatuses({})).toEqual([]);
    expect(mailedStatuses(null)).toEqual([]);
    expect(alreadyMailed({}, 'shipped')).toBe(false);
  });
  it('ignores a malformed field rather than throwing', () => {
    expect(mailedStatuses({ mailedStatuses: 'shipped' as any })).toEqual([]);
    expect(mailedStatuses({ mailedStatuses: ['shipped', 3, null] as any })).toEqual(['shipped']);
  });
  it('records a status once', () => {
    const once = withMailed({}, 'shipped');
    expect(once).toEqual(['shipped']);
    expect(withMailed({ mailedStatuses: once }, 'shipped')).toEqual(['shipped']);
    expect(withMailed({ mailedStatuses: once }, 'completed')).toEqual(['shipped', 'completed']);
    expect(alreadyMailed({ mailedStatuses: once }, 'shipped')).toBe(true);
  });
});
