import { describe, it, expect } from 'vitest';
import {
  MIN_WITHDRAWAL_ALL,
  MIN_WITHDRAWAL_EUR,
  PAYOUT_GATE_FROM,
  amountToMinimum,
  canRequestWithdrawal,
  isCashSettled,
  maskIban,
  normalizeIban,
  orderCompletedAt,
  summarizeSellerBalance,
  validateBankDetails,
} from '@/lib/payouts';

const SELLER = 'seller-1';
const OTHER = 'seller-2';

/** An order with one €100 line for SELLER unless told otherwise. */
function order(over: Record<string, any> = {}) {
  return {
    status: 'completed',
    paymentMethod: 'cod',
    items: [{ sellerId: SELLER, price: 100, quantity: 1 }],
    subtotal: 100,
    shippingFee: 0,
    totalAmount: 100,
    // After the gate, so nothing is grandfathered unless a test says so.
    statusHistory: [{ status: 'completed', at: '2026-10-01T10:00:00.000Z' }],
    ...over,
  };
}

describe('the withdrawal floor', () => {
  it('is 5.000 ALL, converted rather than hardcoded in euro', () => {
    expect(MIN_WITHDRAWAL_ALL).toBe(5000);
    expect(MIN_WITHDRAWAL_EUR).toBeCloseTo(5000 / 93, 10);
  });

  it('reports what is still missing', () => {
    expect(amountToMinimum(0)).toBeCloseTo(MIN_WITHDRAWAL_EUR, 10);
    expect(amountToMinimum(MIN_WITHDRAWAL_EUR)).toBe(0);
    expect(amountToMinimum(MIN_WITHDRAWAL_EUR + 10)).toBe(0);
  });
});

describe('isCashSettled', () => {
  // The whole point of the gate: completed says the buyer has the parcel,
  // not that Marigo has the money.
  it('is false for a completed cash order nobody has confirmed', () => {
    expect(isCashSettled(order() as any)).toBe(false);
  });

  it('is true once an operator stamps it', () => {
    expect(isCashSettled(order({ cashSettledAt: '2026-10-02T09:00:00.000Z' }) as any)).toBe(true);
  });

  it('is true for a card order — capture already moved the funds', () => {
    expect(isCashSettled(order({ paymentMethod: 'card' }) as any)).toBe(true);
  });

  // Grandfathering: introducing the gate must not zero out existing sellers.
  it('is true for an order completed before the gate existed', () => {
    const before = new Date(PAYOUT_GATE_FROM - 86_400_000).toISOString();
    expect(isCashSettled(order({ statusHistory: [{ status: 'completed', at: before }] }) as any)).toBe(true);
  });

  it('is false for an order completed after the gate', () => {
    const after = new Date(PAYOUT_GATE_FROM + 86_400_000).toISOString();
    expect(isCashSettled(order({ statusHistory: [{ status: 'completed', at: after }] }) as any)).toBe(false);
  });

  it('falls back to createdAt when the status log is missing', () => {
    const before = new Date(PAYOUT_GATE_FROM - 86_400_000).toISOString();
    expect(isCashSettled(order({ statusHistory: undefined, createdAt: before }) as any)).toBe(true);
  });
});

describe('orderCompletedAt', () => {
  it('takes the last completed entry, not the first status', () => {
    const d = orderCompletedAt(
      order({
        statusHistory: [
          { status: 'confirmed', at: '2026-10-01T08:00:00.000Z' },
          { status: 'completed', at: '2026-10-05T08:00:00.000Z' },
        ],
      }) as any,
    );
    expect(d?.toISOString()).toBe('2026-10-05T08:00:00.000Z');
  });

  it('survives an unparseable timestamp', () => {
    expect(
      orderCompletedAt(order({ statusHistory: [{ status: 'completed', at: 'nonsense' }], createdAt: undefined }) as any),
    ).toBeNull();
  });
});

describe('summarizeSellerBalance', () => {
  const rate = 0.15;

  it('splits completed money by whether the cash arrived', () => {
    const b = summarizeSellerBalance(
      [order(), order({ cashSettledAt: '2026-10-02T09:00:00.000Z' })] as any,
      SELLER,
      rate,
    );
    expect(b.available).toBeCloseTo(85, 6);
    expect(b.clearing).toBeCloseTo(85, 6);
    expect(b.lifetime).toBeCloseTo(170, 6);
  });

  it('counts an in-flight order as pending, not available', () => {
    const b = summarizeSellerBalance([order({ status: 'shipped' })] as any, SELLER, rate);
    expect(b.available).toBe(0);
    expect(b.clearing).toBe(0);
    expect(b.pending).toBeCloseTo(85, 6);
  });

  it('ignores refunded and cancelled orders entirely', () => {
    const b = summarizeSellerBalance(
      [order({ status: 'refunded' }), order({ status: 'cancelled' })] as any,
      SELLER,
      rate,
    );
    expect(b).toMatchObject({ available: 0, clearing: 0, pending: 0, lifetime: 0 });
  });

  it("counts only this seller's lines on a shared order", () => {
    const shared = order({
      items: [
        { sellerId: SELLER, price: 100, quantity: 1 },
        { sellerId: OTHER, price: 500, quantity: 1 },
      ],
      cashSettledAt: '2026-10-02T09:00:00.000Z',
    });
    expect(summarizeSellerBalance([shared] as any, SELLER, rate).available).toBeCloseTo(85, 6);
  });

  // Without this a seller could withdraw the same earnings every week: the
  // orders that funded a past payout are still completed and still settled.
  it('subtracts money already paid out', () => {
    const b = summarizeSellerBalance(
      [order({ cashSettledAt: '2026-10-02T09:00:00.000Z' })] as any,
      SELLER,
      rate,
      [{ amount: 85, status: 'paid' }],
    );
    expect(b.available).toBe(0);
    expect(b.paid).toBe(85);
  });

  it('holds back an open request so it cannot be claimed twice', () => {
    for (const status of ['pending', 'approved']) {
      const b = summarizeSellerBalance(
        [order({ cashSettledAt: '2026-10-02T09:00:00.000Z' })] as any,
        SELLER,
        rate,
        [{ amount: 85, status }],
      );
      expect(b.available).toBe(0);
      expect(b.requested).toBe(85);
    }
  });

  it('frees the money again when a request is rejected', () => {
    const b = summarizeSellerBalance(
      [order({ cashSettledAt: '2026-10-02T09:00:00.000Z' })] as any,
      SELLER,
      rate,
      [{ amount: 85, status: 'rejected' }],
    );
    expect(b.available).toBeCloseTo(85, 6);
    expect(b.requested).toBe(0);
  });

  it('never reports a negative balance', () => {
    const b = summarizeSellerBalance(
      [order({ cashSettledAt: '2026-10-02T09:00:00.000Z' })] as any,
      SELLER,
      rate,
      [{ amount: 1000, status: 'paid' }],
    );
    expect(b.available).toBe(0);
  });

  it('handles no orders and no requests', () => {
    expect(summarizeSellerBalance(null, SELLER, rate, null)).toMatchObject({
      available: 0,
      clearing: 0,
      pending: 0,
      requested: 0,
      paid: 0,
      lifetime: 0,
    });
  });
});

describe('canRequestWithdrawal', () => {
  it('refuses below the floor', () => {
    expect(canRequestWithdrawal({ available: MIN_WITHDRAWAL_EUR - 1, requested: 0 })).toEqual({
      ok: false,
      reason: 'below_minimum',
    });
  });

  it('allows exactly the floor — a seller on the line is over it', () => {
    expect(canRequestWithdrawal({ available: MIN_WITHDRAWAL_EUR, requested: 0 })).toEqual({ ok: true });
  });

  it('refuses while another request is open', () => {
    expect(canRequestWithdrawal({ available: MIN_WITHDRAWAL_EUR * 2, requested: 10 })).toEqual({
      ok: false,
      reason: 'request_open',
    });
  });

  it('refuses an empty balance', () => {
    expect(canRequestWithdrawal({ available: 0, requested: 0 })).toEqual({
      ok: false,
      reason: 'nothing_available',
    });
  });
});

describe('bank details', () => {
  const valid = { accountHolder: 'Ana Hoxha', iban: 'AL35202111090000000001234567', bankName: 'BKT' };

  it('accepts a well-formed Albanian account', () => {
    expect(validateBankDetails(valid).ok).toBe(true);
  });

  it('accepts the IBAN however it was spaced or cased', () => {
    expect(validateBankDetails({ ...valid, iban: 'al35 2021 1109 0000 0000 0123 4567' }).ok).toBe(true);
  });

  it('names each missing field rather than failing as a whole', () => {
    const r = validateBankDetails({ accountHolder: 'A', iban: '123', bankName: '' });
    expect(r.ok).toBe(false);
    expect(r.errors.accountHolder).toBeTruthy();
    expect(r.errors.iban).toBeTruthy();
    expect(r.errors.bankName).toBeTruthy();
  });

  it('treats SWIFT as optional but checks it when given', () => {
    expect(validateBankDetails({ ...valid, swift: '' }).ok).toBe(true);
    expect(validateBankDetails({ ...valid, swift: 'NCBAALTX' }).ok).toBe(true);
    expect(validateBankDetails({ ...valid, swift: 'nope' }).errors.swift).toBeTruthy();
  });

  it('rejects nothing at all', () => {
    expect(validateBankDetails(null).ok).toBe(false);
    expect(validateBankDetails({}).ok).toBe(false);
  });

  it('normalises and masks for display', () => {
    expect(normalizeIban(' al35 2021 ')).toBe('AL352021');
    expect(maskIban('AL35202111090000000001234567')).toMatch(/4567$/);
    expect(maskIban('AL35202111090000000001234567')).not.toContain('AL35');
    expect(maskIban('')).toBe('');
  });
});
