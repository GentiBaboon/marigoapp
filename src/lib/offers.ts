/**
 * Offer negotiation — the single source of truth for the buyer↔seller haggle.
 *
 * This logic used to live inline in three places (the make-offer sheet, the
 * negotiation page, the offers list) and had drifted apart in every one of
 * them: three status vocabularies, two spellings of the actor field, and no
 * agreement on which amount is "current" once a counter exists. Everything
 * that decides *what an offer means* now lives here, so the UI only renders.
 *
 * Deliberately free of Firebase imports beyond `Timestamp` so it can be unit
 * tested without a Firestore instance.
 */
import { Timestamp } from 'firebase/firestore';
import { toDate, type FirestoreTimestamp } from '@/lib/types';

// ─── Status ───────────────────────────────────────────────────────────────────

export const OFFER_STATUSES = [
  'pending',    // waiting on the seller
  'countered',  // seller has countered; waiting on the buyer
  'accepted',   // terminal — a price is agreed
  'declined',   // terminal — refused by either side
  'withdrawn',  // terminal — pulled by the buyer
  'expired',    // terminal — ran out of time
] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];

export type OfferActor = 'buyer' | 'seller';

/** Statuses that can still change. Everything else is history. */
export const OPEN_STATUSES: readonly OfferStatus[] = ['pending', 'countered'];

export function isOpen(status: string): boolean {
  return OPEN_STATUSES.includes(normalizeStatus(status));
}

/**
 * Older documents were written with 'rejected' — the vocabulary in
 * `OfferStatusEnum` — while the UI has always said 'declined'. Fold the two so
 * a pre-existing offer does not render as an unknown status with a grey badge.
 */
export function normalizeStatus(status: string | undefined): OfferStatus {
  if (status === 'rejected') return 'declined';
  return (OFFER_STATUSES as readonly string[]).includes(status ?? '')
    ? (status as OfferStatus)
    : 'pending';
}

/** Whose turn it is, or null once the negotiation is over. */
export function awaitingParty(status: string): OfferActor | null {
  const s = normalizeStatus(status);
  if (s === 'pending') return 'seller';
  if (s === 'countered') return 'buyer';
  return null;
}

/**
 * `audience` is who is reading. Buyer and seller get second-person copy
 * ("Awaiting your reply"); an admin is neither party, so the open states name
 * whose turn it is instead — the operator's question is "who is this waiting
 * on?", never "what should I do?".
 */
export function offerStatusLabel(status: string, audience: OfferActor | 'admin'): string {
  const s = normalizeStatus(status);
  switch (s) {
    case 'pending':
      return audience === 'seller' ? 'Awaiting your reply' : 'Awaiting seller';
    case 'countered':
      if (audience === 'admin') return 'Awaiting buyer';
      return audience === 'buyer' ? 'Counter-offer for you' : 'You countered';
    case 'accepted':
      return 'Accepted';
    case 'declined':
      return 'Declined';
    case 'withdrawn':
      return 'Withdrawn';
    case 'expired':
      return 'Expired';
  }
}

// ─── The state machine ────────────────────────────────────────────────────────

export type OfferAction = 'accept' | 'decline' | 'counter' | 'withdraw';

/**
 * Which actions each side may take from a given status.
 *
 * The asymmetry is the point: only the buyer can withdraw (it is their offer),
 * and a counter flips whose turn it is rather than ending the negotiation —
 * `countered` by the seller waits on the buyer, and a buyer counter-counter
 * puts it back to `pending` on the seller.
 */
const TRANSITIONS: Record<string, Record<OfferActor, OfferAction[]>> = {
  pending: {
    seller: ['accept', 'decline', 'counter'],
    buyer: ['withdraw'],
  },
  countered: {
    buyer: ['accept', 'decline', 'counter', 'withdraw'],
    seller: ['decline'],
  },
};

export function allowedActions(status: string, actor: OfferActor | null): OfferAction[] {
  if (!actor) return [];
  return TRANSITIONS[normalizeStatus(status)]?.[actor] ?? [];
}

export function canPerform(status: string, actor: OfferActor | null, action: OfferAction): boolean {
  return allowedActions(status, actor).includes(action);
}

/** The status an action lands the offer in. A counter alternates the turn. */
export function statusAfter(action: OfferAction, actor: OfferActor): OfferStatus {
  switch (action) {
    case 'accept': return 'accepted';
    case 'decline': return 'declined';
    case 'withdraw': return 'withdrawn';
    case 'counter': return actor === 'seller' ? 'countered' : 'pending';
  }
}

// ─── Amounts ──────────────────────────────────────────────────────────────────

/**
 * Reject an offer this far below the asking price. Without a floor a listing
 * collects €1 offers on a €500 bag, which is noise the seller has to clear.
 */
export const MIN_OFFER_RATIO = 0.1;

export interface OfferAmountShape {
  status?: string;
  amount?: number;
  offerAmount?: number;
  counterOfferAmount?: number;
}

/**
 * The amount actually on the table. Once the seller counters, the buyer's
 * original number is history — the list row and the accept button must both
 * quote the counter, or the two disagree about what accepting costs.
 */
export function currentAmount(offer: OfferAmountShape): number {
  const base = offer.offerAmount ?? offer.amount ?? 0;
  if (normalizeStatus(offer.status) === 'countered' && offer.counterOfferAmount != null) {
    return offer.counterOfferAmount;
  }
  // An accepted counter is what was agreed, so it stays the operative figure.
  if (normalizeStatus(offer.status) === 'accepted' && offer.counterOfferAmount != null) {
    return offer.counterOfferAmount;
  }
  return base;
}

export type AmountCheck = { ok: true } | { ok: false; reason: string };

/** All amounts are EUR — the storage currency. See CLAUDE.md §9. */
export function validateOfferAmount(amountEur: number, listingPriceEur: number): AmountCheck {
  if (!Number.isFinite(amountEur) || amountEur <= 0) {
    return { ok: false, reason: 'Enter an offer amount.' };
  }
  if (listingPriceEur > 0 && amountEur >= listingPriceEur) {
    return { ok: false, reason: 'Your offer is at or above the asking price — just buy it instead.' };
  }
  if (listingPriceEur > 0 && amountEur < listingPriceEur * MIN_OFFER_RATIO) {
    return { ok: false, reason: 'That is too far below the asking price to be considered.' };
  }
  return { ok: true };
}

/** Counters are bounded by the same floor, but may sit above the buyer's bid. */
export function validateCounterAmount(
  amountEur: number,
  listingPriceEur: number,
  buyerAmountEur: number,
): AmountCheck {
  if (!Number.isFinite(amountEur) || amountEur <= 0) {
    return { ok: false, reason: 'Enter a counter amount.' };
  }
  if (listingPriceEur > 0 && amountEur > listingPriceEur) {
    return { ok: false, reason: 'A counter cannot exceed your asking price.' };
  }
  if (amountEur <= buyerAmountEur) {
    return { ok: false, reason: 'Counter above the buyer’s offer, or simply accept it.' };
  }
  return { ok: true };
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface OfferHistoryEntry {
  action: string;
  amount: number;
  by_user: string;
  by_role: OfferActor;
  timestamp: FirestoreTimestamp;
}

/**
 * A history row.
 *
 * `Timestamp.now()` and **never** `serverTimestamp()`: Firestore rejects
 * sentinel field values inside arrays outright — "serverTimestamp() is not
 * currently supported inside arrays" — thrown by the SDK before the write is
 * even attempted. That single mistake is what made every offer, and every
 * accept/decline/counter, fail with "Failed to send offer".
 *
 * The cost is a client clock rather than a server one. For a display-only
 * audit trail that is an acceptable trade; the authoritative `createdAt` and
 * `updatedAt` on the document itself are still server-stamped.
 */
export function historyEntry(args: {
  action: OfferAction | 'created';
  amount: number;
  byUser: string;
  byRole: OfferActor;
}): OfferHistoryEntry {
  return {
    action: args.action,
    amount: args.amount,
    by_user: args.byUser,
    by_role: args.byRole,
    timestamp: Timestamp.now(),
  };
}

const HISTORY_LABELS: Record<string, string> = {
  created: 'Offered',
  counter: 'Countered with',
  countered: 'Countered with',
  accept: 'Accepted',
  accepted: 'Accepted',
  decline: 'Declined',
  declined: 'Declined',
  withdraw: 'Withdrew',
  withdrawn: 'Withdrew',
};

export function historyLabel(action: string): string {
  return HISTORY_LABELS[action] ?? action;
}

// ─── Expiry ───────────────────────────────────────────────────────────────────

/** An offer nobody answers should not sit "pending" forever. */
export const OFFER_EXPIRY_DAYS = 7;

export function offerExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + OFFER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Expiry is evaluated on read rather than by a scheduled job. A cron would be
 * more correct, but this keeps the UI honest with no infrastructure: an offer
 * past its date renders as expired and offers no actions.
 */
export function isExpired(offer: { status?: string; expiresAt?: FirestoreTimestamp }, now: Date = new Date()): boolean {
  if (!isOpen(offer.status ?? '')) return false;
  const due = toDate(offer.expiresAt as FirestoreTimestamp);
  return due != null && due.getTime() < now.getTime();
}

/** Status as it should be shown, folding in expiry. */
export function effectiveStatus(
  offer: { status?: string; expiresAt?: FirestoreTimestamp },
  now: Date = new Date(),
): OfferStatus {
  return isExpired(offer, now) ? 'expired' : normalizeStatus(offer.status);
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export function roleFor(
  uid: string | undefined,
  offer: { buyerId?: string } | null,
  product: { sellerId?: string } | null,
): OfferActor | null {
  if (!uid) return null;
  // Seller is checked first: on a self-listing the seller must never be
  // treated as the buyer and handed withdraw rights over someone else's offer.
  if (product?.sellerId && uid === product.sellerId) return 'seller';
  if (offer?.buyerId && uid === offer.buyerId) return 'buyer';
  return null;
}

// ─── Admin summary ────────────────────────────────────────────────────────────

export interface OfferSummary {
  total: number;
  /** Open and waiting on the seller. */
  awaitingSeller: number;
  /** Open and waiting on the buyer (the seller has countered). */
  awaitingBuyer: number;
  accepted: number;
  /** Accepted as a share of every *settled* negotiation — open ones are
   *  excluded, so the figure does not sink under whatever is still pending. */
  acceptanceRate: number | null;
}

/**
 * The counts on the admin offers page. Expiry is folded in via
 * `effectiveStatus`, so an offer that lapsed unanswered is not reported as
 * still waiting on anyone.
 */
export function summarizeOffers(
  offers: ReadonlyArray<{ status?: string; expiresAt?: FirestoreTimestamp }>,
  now: Date = new Date(),
): OfferSummary {
  let awaitingSeller = 0;
  let awaitingBuyer = 0;
  let accepted = 0;
  let settled = 0;
  for (const offer of offers) {
    const status = effectiveStatus(offer, now);
    if (status === 'pending') awaitingSeller += 1;
    else if (status === 'countered') awaitingBuyer += 1;
    else {
      settled += 1;
      if (status === 'accepted') accepted += 1;
    }
  }
  return {
    total: offers.length,
    awaitingSeller,
    awaitingBuyer,
    accepted,
    acceptanceRate: settled > 0 ? accepted / settled : null,
  };
}
