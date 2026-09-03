import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  normalizeStatus,
  effectiveStatus,
  isOpen,
  awaitingParty,
  allowedActions,
  canPerform,
  statusAfter,
  currentAmount,
  validateOfferAmount,
  validateCounterAmount,
  historyEntry,
  historyLabel,
  offerExpiresAt,
  isExpired,
  roleFor,
  offerStatusLabel,
  summarizeOffers,
  OFFER_EXPIRY_DAYS,
  MIN_OFFER_RATIO,
} from '@/lib/offers';

describe('status vocabulary', () => {
  // Documents written before the vocabularies were merged say 'rejected'.
  it('folds the legacy "rejected" onto "declined"', () => {
    expect(normalizeStatus('rejected')).toBe('declined');
  });

  it('falls back to pending for anything unrecognised', () => {
    expect(normalizeStatus(undefined)).toBe('pending');
    expect(normalizeStatus('nonsense')).toBe('pending');
  });

  it('knows which statuses are still live', () => {
    expect(isOpen('pending')).toBe(true);
    expect(isOpen('countered')).toBe(true);
    expect(isOpen('accepted')).toBe(false);
    expect(isOpen('rejected')).toBe(false);
  });

  it('names whose turn it is', () => {
    expect(awaitingParty('pending')).toBe('seller');
    expect(awaitingParty('countered')).toBe('buyer');
    expect(awaitingParty('accepted')).toBeNull();
  });

  it('labels a status differently for each side', () => {
    expect(offerStatusLabel('pending', 'seller')).toBe('Awaiting your reply');
    expect(offerStatusLabel('pending', 'buyer')).toBe('Awaiting seller');
    expect(offerStatusLabel('countered', 'buyer')).toBe('Counter-offer for you');
    expect(offerStatusLabel('countered', 'seller')).toBe('You countered');
  });

  it('names whose turn it is for an admin, who is neither party', () => {
    expect(offerStatusLabel('pending', 'admin')).toBe('Awaiting seller');
    expect(offerStatusLabel('countered', 'admin')).toBe('Awaiting buyer');
    expect(offerStatusLabel('accepted', 'admin')).toBe('Accepted');
  });
});

describe('transitions', () => {
  it('lets the seller act on a pending offer, but not withdraw it', () => {
    expect(allowedActions('pending', 'seller').sort()).toEqual(['accept', 'counter', 'decline']);
    expect(canPerform('pending', 'seller', 'withdraw')).toBe(false);
  });

  // The buyer must not be able to accept their own offer.
  it('lets the buyer only withdraw while it is the seller’s turn', () => {
    expect(allowedActions('pending', 'buyer')).toEqual(['withdraw']);
    expect(canPerform('pending', 'buyer', 'accept')).toBe(false);
  });

  it('hands the turn to the buyer once countered', () => {
    expect(canPerform('countered', 'buyer', 'accept')).toBe(true);
    expect(canPerform('countered', 'seller', 'accept')).toBe(false);
  });

  it('allows no action at all on a closed offer', () => {
    for (const status of ['accepted', 'declined', 'withdrawn', 'expired']) {
      expect(allowedActions(status, 'buyer')).toEqual([]);
      expect(allowedActions(status, 'seller')).toEqual([]);
    }
  });

  it('gives a bystander no actions', () => {
    expect(allowedActions('pending', null)).toEqual([]);
  });

  // A counter alternates the turn rather than ending the negotiation.
  it('alternates the turn on a counter', () => {
    expect(statusAfter('counter', 'seller')).toBe('countered');
    expect(statusAfter('counter', 'buyer')).toBe('pending');
    expect(statusAfter('accept', 'buyer')).toBe('accepted');
    expect(statusAfter('withdraw', 'buyer')).toBe('withdrawn');
  });
});

describe('currentAmount', () => {
  it('is the buyer’s offer while pending', () => {
    expect(currentAmount({ status: 'pending', offerAmount: 70, counterOfferAmount: 85 })).toBe(70);
  });

  // Quoting the original after a counter makes the accept button lie.
  it('is the counter once the seller has countered', () => {
    expect(currentAmount({ status: 'countered', offerAmount: 70, counterOfferAmount: 85 })).toBe(85);
  });

  it('stays on the counter after it is accepted', () => {
    expect(currentAmount({ status: 'accepted', offerAmount: 70, counterOfferAmount: 85 })).toBe(85);
  });

  it('reads the legacy `amount` field when `offerAmount` is absent', () => {
    expect(currentAmount({ status: 'pending', amount: 50 })).toBe(50);
  });

  it('is 0 rather than NaN for an empty offer', () => {
    expect(currentAmount({})).toBe(0);
  });
});

describe('amount validation', () => {
  it('rejects nothing, zero and negatives', () => {
    expect(validateOfferAmount(NaN, 100).ok).toBe(false);
    expect(validateOfferAmount(0, 100).ok).toBe(false);
    expect(validateOfferAmount(-5, 100).ok).toBe(false);
  });

  it('accepts a sensible offer below the asking price', () => {
    expect(validateOfferAmount(80, 100).ok).toBe(true);
  });

  // At or above list there is nothing to negotiate — it is a purchase.
  it('rejects an offer at or above the asking price', () => {
    expect(validateOfferAmount(100, 100).ok).toBe(false);
    expect(validateOfferAmount(120, 100).ok).toBe(false);
  });

  it('rejects a lowball under the floor', () => {
    expect(validateOfferAmount(100 * MIN_OFFER_RATIO - 0.01, 100).ok).toBe(false);
    expect(validateOfferAmount(100 * MIN_OFFER_RATIO, 100).ok).toBe(true);
  });

  it('counters must beat the buyer and not exceed the ask', () => {
    expect(validateCounterAmount(85, 100, 70).ok).toBe(true);
    expect(validateCounterAmount(70, 100, 70).ok).toBe(false);
    expect(validateCounterAmount(101, 100, 70).ok).toBe(false);
  });
});

describe('history', () => {
  // The bug that broke every offer: Firestore rejects sentinel values inside
  // arrays, so a history entry must carry a concrete Timestamp.
  it('stamps a concrete Timestamp, never a server sentinel', () => {
    const e = historyEntry({ action: 'created', amount: 70, byUser: 'u1', byRole: 'buyer' });
    expect(e.timestamp).toBeInstanceOf(Timestamp);
    expect(typeof (e.timestamp as Timestamp).toDate).toBe('function');
    expect(JSON.stringify(e)).not.toContain('_methodName');
  });

  it('records who acted and in what capacity', () => {
    const e = historyEntry({ action: 'counter', amount: 85, byUser: 'u2', byRole: 'seller' });
    expect(e).toMatchObject({ action: 'counter', amount: 85, by_user: 'u2', by_role: 'seller' });
  });

  it('labels both the verb and past-tense spellings', () => {
    expect(historyLabel('created')).toBe('Offered');
    expect(historyLabel('counter')).toBe('Countered with');
    expect(historyLabel('countered')).toBe('Countered with');
  });
});

describe('expiry', () => {
  const base = new Date('2026-01-01T00:00:00Z');

  it('expires a set number of days out', () => {
    const due = offerExpiresAt(base);
    expect(due.getTime() - base.getTime()).toBe(OFFER_EXPIRY_DAYS * 86_400_000);
  });

  it('treats a lapsed open offer as expired', () => {
    const expiresAt = Timestamp.fromDate(new Date('2026-01-02T00:00:00Z'));
    expect(isExpired({ status: 'pending', expiresAt }, new Date('2026-01-03T00:00:00Z'))).toBe(true);
    expect(isExpired({ status: 'pending', expiresAt }, new Date('2026-01-01T00:00:00Z'))).toBe(false);
  });

  // An accepted offer stays accepted forever; expiry must not rewrite history.
  it('never expires a closed offer', () => {
    const expiresAt = Timestamp.fromDate(new Date('2026-01-02T00:00:00Z'));
    const late = new Date('2027-01-01T00:00:00Z');
    expect(isExpired({ status: 'accepted', expiresAt }, late)).toBe(false);
    expect(effectiveStatus({ status: 'accepted', expiresAt }, late)).toBe('accepted');
  });

  it('reports an expired offer as expired without a write', () => {
    const expiresAt = Timestamp.fromDate(new Date('2026-01-02T00:00:00Z'));
    const late = new Date('2026-01-05T00:00:00Z');
    expect(effectiveStatus({ status: 'pending', expiresAt }, late)).toBe('expired');
    expect(allowedActions(effectiveStatus({ status: 'pending', expiresAt }, late), 'seller')).toEqual([]);
  });

  it('leaves an offer with no expiry date open', () => {
    expect(isExpired({ status: 'pending' })).toBe(false);
  });
});

describe('roleFor', () => {
  const offer = { buyerId: 'buyer1' };
  const product = { sellerId: 'seller1' };

  it('identifies each side', () => {
    expect(roleFor('buyer1', offer, product)).toBe('buyer');
    expect(roleFor('seller1', offer, product)).toBe('seller');
  });

  it('gives a stranger no role', () => {
    expect(roleFor('someone', offer, product)).toBeNull();
    expect(roleFor(undefined, offer, product)).toBeNull();
  });

  // Seller wins the tie, so a self-offer can never hand out withdraw rights
  // over an offer the user did not make.
  it('resolves seller first when one user is both', () => {
    expect(roleFor('same', { buyerId: 'same' }, { sellerId: 'same' })).toBe('seller');
  });
});

describe('summarizeOffers', () => {
  const future = Timestamp.fromDate(new Date(Date.now() + 86_400_000));
  const past = Timestamp.fromDate(new Date(Date.now() - 86_400_000));

  it('counts whose turn it is and folds expiry in', () => {
    const summary = summarizeOffers([
      { status: 'pending', expiresAt: future },
      { status: 'pending', expiresAt: past }, // lapsed — waits on nobody
      { status: 'countered', expiresAt: future },
      { status: 'accepted' },
      { status: 'declined' },
      { status: 'rejected' }, // legacy spelling of declined
    ]);
    expect(summary.total).toBe(6);
    expect(summary.awaitingSeller).toBe(1);
    expect(summary.awaitingBuyer).toBe(1);
    expect(summary.accepted).toBe(1);
    // 4 settled (expired, accepted, declined, rejected), 1 accepted.
    expect(summary.acceptanceRate).toBe(0.25);
  });

  it('has no acceptance rate until something has settled', () => {
    expect(summarizeOffers([{ status: 'pending', expiresAt: future }]).acceptanceRate).toBeNull();
    expect(summarizeOffers([]).acceptanceRate).toBeNull();
  });
});
