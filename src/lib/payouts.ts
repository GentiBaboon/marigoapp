/**
 * Seller payouts — when money is withdrawable, and what a withdrawal costs.
 *
 * Every decision that needs no I/O lives here so it is directly testable and
 * so the seller's wallet, the withdraw form, the admin queue and the API
 * route cannot drift into three different answers about the same balance.
 * That drift is exactly what `src/lib/order-money.ts` was written to stop for
 * order money; this is its payout half, and it builds on `sellerNet()` rather
 * than recomputing commission.
 *
 * ## The money only moves once Marigo actually holds it
 *
 * Nearly every order is cash on delivery: the courier collects notes at the
 * door and the cash reaches Marigo later, through the logistics partner.
 * Until it does, a seller's "earnings" are a number on a screen that Marigo
 * cannot pay out — the platform does not have the money yet. Marking an
 * order `completed` says the buyer received the parcel; it does not say the
 * cash arrived. Only an operator knows that, so only an operator can say it:
 * `orders.cashSettledAt`, set from the admin order page.
 *
 * A **card** order is different — those funds are captured into Stripe at
 * completion, so completion *is* settlement. Cards are switched off today
 * (`CARD_PAYMENTS_ENABLED`), but the rule is written so they need no second
 * confirmation if they come back.
 *
 * ## Grandfathering
 *
 * Introducing the gate retroactively would drop every existing seller's
 * available balance to zero overnight and make the platform look like it had
 * lost their money. Orders completed before `PAYOUT_GATE_FROM` are therefore
 * treated as settled. New orders need the tick.
 */

import { ALL_PER_EUR, toDate } from './defaults';
import { sellerNet, type MoneyOrder } from './order-money';

/**
 * The floor for a withdrawal, in lek: a bank transfer has a fixed cost and an
 * operator has to action each one by hand, so paying out 300 ALL costs more
 * than it moves.
 *
 * **This is the seller's own money, after commission** — what actually lands
 * in their account — not the order value. A seller looking at "4.800 ALL
 * available" is 200 short, not 200 + 15%.
 */
export const MIN_WITHDRAWAL_ALL = 5000;

/** The same floor in EUR, which is what orders and requests are stored in.
 *  Derived, never hardcoded — see the note on `ALL_PER_EUR`. */
export const MIN_WITHDRAWAL_EUR = MIN_WITHDRAWAL_ALL / ALL_PER_EUR;

/**
 * Orders completed before this instant count as cash-settled without an
 * operator tick. See "Grandfathering" above. Frozen deliberately: it is a
 * historical cutoff, not a rolling window, so it must never become
 * `Date.now()`.
 */
export const PAYOUT_GATE_FROM = Date.UTC(2026, 8, 15); // 2026-09-15

export type PayoutRequestStatus = 'pending' | 'approved' | 'paid' | 'rejected';

/** Requests that have not been paid but have claimed part of the balance.
 *  Their amount is held back so a seller cannot request the same money twice
 *  by opening the form in two tabs. */
export const OPEN_REQUEST_STATUSES: ReadonlySet<PayoutRequestStatus> = new Set([
  'pending',
  'approved',
]);

export type PayoutOrder = MoneyOrder & {
  status?: string;
  paymentMethod?: string;
  cashSettledAt?: unknown;
  createdAt?: unknown;
  statusHistory?: Array<{ status?: string; at?: string }>;
};

export type PayoutRequestLike = {
  amount?: number;
  status?: string;
};

/** When did this order complete? Read from the status log, which is the only
 *  place a completion time is recorded; `createdAt` is the fallback for rows
 *  written before the log existed. */
export function orderCompletedAt(order: PayoutOrder | null | undefined): Date | null {
  const entry = (order?.statusHistory ?? []).filter((h) => h?.status === 'completed').pop();
  if (entry?.at) {
    const d = new Date(entry.at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return toDate(order?.createdAt as any);
}

/**
 * Has the cash for this order reached Marigo?
 *
 * Three ways to be true, in order of authority: an operator stamped it, the
 * order was paid by card (captured, so already held), or it completed before
 * the gate existed.
 */
export function isCashSettled(order: PayoutOrder | null | undefined, now = Date.now()): boolean {
  if (!order) return false;
  if (toDate(order.cashSettledAt as any)) return true;
  if (order.paymentMethod === 'card') return true;
  const completedAt = orderCompletedAt(order);
  if (completedAt && completedAt.getTime() < PAYOUT_GATE_FROM) return true;
  void now;
  return false;
}

export type SellerBalance = {
  /** Completed, cash in hand, not already claimed — this is withdrawable. */
  available: number;
  /** Completed, but Marigo is still waiting on the cash from logistics. */
  clearing: number;
  /** Sold but not yet completed — the parcel is still in flight. */
  pending: number;
  /** Held by requests that are open (pending or approved, not yet paid). */
  requested: number;
  /** Already transferred out. */
  paid: number;
  /** Lifetime earnings after commission, whatever stage they are at. */
  lifetime: number;
};

const REVERSED = new Set(['cancelled', 'refunded']);
const IN_FLIGHT = new Set([
  'confirmed',
  'processing',
  'in_preparation',
  'prepared',
  'shipped',
  'delivered',
  'cancel_requested',
  'refund_requested',
  'return_initiated',
]);

/**
 * The seller's money, split by how far along it is.
 *
 * `available` is deliberately net of both open requests and paid ones: the
 * orders that funded a past payout are still `completed` and still settled,
 * so without subtracting them a seller could withdraw the same earnings every
 * week forever.
 */
export function summarizeSellerBalance(
  orders: readonly PayoutOrder[] | null | undefined,
  sellerId: string,
  commissionRate: number,
  requests: readonly PayoutRequestLike[] | null | undefined = [],
  now = Date.now(),
): SellerBalance {
  let settled = 0;
  let clearing = 0;
  let pending = 0;
  let lifetime = 0;

  for (const order of orders ?? []) {
    const status = order?.status ?? '';
    if (REVERSED.has(status)) continue;
    const net = sellerNet(order, sellerId, commissionRate);
    if (net <= 0) continue;

    if (status === 'completed') {
      lifetime += net;
      if (isCashSettled(order, now)) settled += net;
      else clearing += net;
    } else if (IN_FLIGHT.has(status)) {
      lifetime += net;
      pending += net;
    }
  }

  let requested = 0;
  let paid = 0;
  for (const r of requests ?? []) {
    const amount = Number(r?.amount) || 0;
    if (amount <= 0) continue;
    const status = String(r?.status ?? '') as PayoutRequestStatus;
    if (status === 'paid') paid += amount;
    else if (OPEN_REQUEST_STATUSES.has(status)) requested += amount;
  }

  // Never negative: an operator paying out more than the ledger accounts for
  // (a goodwill transfer, a correction) should read as zero available, not as
  // a debt the seller appears to owe.
  const available = Math.max(0, settled - requested - paid);

  return { available, clearing, pending, requested, paid, lifetime };
}

export type WithdrawalBlock =
  | { ok: true }
  | { ok: false; reason: 'below_minimum' | 'request_open' | 'nothing_available' };

/**
 * May this seller open a withdrawal right now?
 *
 * One open request at a time — a queue of part-claims on one balance is
 * confusing for the seller and a reconciliation problem for whoever makes the
 * transfers.
 */
export function canRequestWithdrawal(balance: {
  available: number;
  requested: number;
}): WithdrawalBlock {
  if (balance.requested > 0) return { ok: false, reason: 'request_open' };
  if (balance.available <= 0) return { ok: false, reason: 'nothing_available' };
  if (balance.available + 1e-9 < MIN_WITHDRAWAL_EUR) return { ok: false, reason: 'below_minimum' };
  return { ok: true };
}

/** How much more the seller needs before they can withdraw, in EUR. 0 once
 *  they are over the line. */
export function amountToMinimum(available: number): number {
  return Math.max(0, MIN_WITHDRAWAL_EUR - (Number(available) || 0));
}

// ── Bank details ────────────────────────────────────────────────────────────

export type BankDetails = {
  accountHolder: string;
  iban: string;
  bankName: string;
  /** Optional — needed for some cross-border transfers, not for a domestic one. */
  swift?: string;
};

/** Strip the spaces people type into an IBAN and upper-case it, so the same
 *  account entered two ways compares equal and prints consistently on the
 *  transfer sheet. */
export function normalizeIban(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Validate what the seller typed.
 *
 * Deliberately shape-only — length and alphabet, not the ISO 7064 checksum.
 * Albanian and Kosovan IBANs are both 20 characters, but a seller may hold an
 * account abroad, and rejecting a valid foreign IBAN because the checksum
 * implementation is subtly wrong would block their money with no way around
 * it. An operator reads these before transferring; a typo surfaces there.
 */
export function validateBankDetails(input: Partial<BankDetails> | null | undefined): {
  ok: boolean;
  errors: Partial<Record<keyof BankDetails, string>>;
} {
  const errors: Partial<Record<keyof BankDetails, string>> = {};
  const holder = String(input?.accountHolder ?? '').trim();
  const iban = normalizeIban(input?.iban);
  const bank = String(input?.bankName ?? '').trim();
  const swift = String(input?.swift ?? '').trim().toUpperCase();

  if (holder.length < 3) errors.accountHolder = 'Enter the name on the account.';
  else if (holder.length > 120) errors.accountHolder = 'That name is too long.';

  if (!iban) errors.iban = 'Enter your IBAN.';
  else if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) errors.iban = 'That does not look like an IBAN.';

  if (bank.length < 2) errors.bankName = 'Enter your bank.';
  else if (bank.length > 120) errors.bankName = 'That bank name is too long.';

  if (swift && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swift)) errors.swift = 'That does not look like a SWIFT/BIC code.';

  return { ok: Object.keys(errors).length === 0, errors };
}

/** Everything but the last four characters of the IBAN, for showing a request
 *  back to the seller or listing it in admin without printing the account in
 *  full on every row. */
export function maskIban(raw: string | null | undefined): string {
  const iban = normalizeIban(raw);
  if (iban.length <= 4) return iban;
  return `${'•'.repeat(Math.min(iban.length - 4, 16))}${iban.slice(-4)}`;
}

export const PAYOUT_STATUS_LABELS: Record<PayoutRequestStatus, string> = {
  pending: 'Awaiting review',
  approved: 'Approved — transfer in progress',
  paid: 'Paid',
  rejected: 'Declined',
};
