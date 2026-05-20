/**
 * Shopify-style order lifecycle helpers.
 *
 * The admin app has four collections — orders, disputes, returns, refunds —
 * plus an append-only finance ledger at `transactions`. Wiring them up by
 * hand from each admin page is error-prone (forgotten cross-refs, ledger
 * gaps, inconsistent statuses). This module is the single source of truth:
 * every lifecycle event goes through one of the helpers below, which:
 *   1. Writes the child record (refund / return / dispute resolution).
 *   2. Appends a `transactions` row so /admin/finance reflects the movement.
 *   3. Patches the parent order with cross-reference ids + refundedAmount.
 *
 * The helpers never throw on partial failure — they best-effort everything
 * and surface a single Error if the primary write failed. Each call is
 * idempotent on the order side: re-applying a refund just re-appends a row,
 * which is acceptable for the ledger model.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  increment,
  type Firestore,
} from 'firebase/firestore';
import type { FirestoreOrder, FirestoreDispute, FirestoreReturn } from '@/lib/types';

const COMMISSION_RATE = 0.15;

/** Internal: append a row to the finance ledger. Returns the new id. */
async function writeTransaction(
  firestore: Firestore,
  payload: {
    type: 'sale' | 'refund' | 'partial_refund' | 'cancellation' | 'payout';
    orderId: string;
    orderNumber: string;
    userId: string;
    amount: number; // signed
    commission: number;
    sellerPayout: number;
    paymentMethod?: string;
    refundId?: string;
    returnId?: string;
    disputeId?: string;
    note?: string;
    createdBy?: string;
  },
): Promise<string> {
  // Strip undefined — Firestore rejects them and these are all optional.
  const clean: Record<string, any> = { ...payload, createdAt: serverTimestamp() };
  for (const k of Object.keys(clean)) if (clean[k] === undefined) delete clean[k];
  const ref = await addDoc(collection(firestore, 'transactions'), clean);
  return ref.id;
}

/**
 * Record a refund for an order. Creates the refund doc, appends a ledger row,
 * and patches the order's cross-refs + refundedAmount. Does NOT change the
 * order's status — callers decide whether this refund makes the order fully
 * 'refunded' or stays 'partially_refunded' (we leave the status to the
 * existing dispute/return paths so we don't fight them).
 *
 * Returns { refundId, transactionId } for the caller to mirror back onto
 * the linked dispute/return if needed.
 */
export async function recordRefund(args: {
  firestore: Firestore;
  order: FirestoreOrder;
  amount: number; // positive; stored absolute, ledger flips sign
  reason: string;
  type?: 'full' | 'partial' | 'cancellation';
  disputeId?: string;
  returnId?: string;
  processedBy?: string;
  processedByName?: string;
}): Promise<{ refundId: string; transactionId: string }> {
  const { firestore, order, amount, reason, type, disputeId, returnId, processedBy, processedByName } = args;
  const refundDoc: Record<string, any> = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestedBy: order.buyerId,
    requestedByName: processedByName || 'Admin',
    reason,
    amount: Math.max(0, amount),
    status: 'processed',
    processedBy: processedBy || 'admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    disputeId,
    returnId,
    type: type || (amount >= order.totalAmount ? 'full' : 'partial'),
  };
  for (const k of Object.keys(refundDoc)) if (refundDoc[k] === undefined) delete refundDoc[k];
  const refundRef = await addDoc(collection(firestore, 'refunds'), refundDoc);

  const commission = -Math.max(0, amount) * COMMISSION_RATE;
  const sellerPayout = -(Math.max(0, amount) + commission); // commission is negative here, so this is -(amt - |commission|)
  const txnType = type === 'cancellation' ? 'cancellation' : (amount >= order.totalAmount ? 'refund' : 'partial_refund');
  const transactionId = await writeTransaction(firestore, {
    type: txnType,
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: order.buyerId,
    amount: -Math.max(0, amount),
    commission,
    sellerPayout,
    paymentMethod: order.paymentMethod,
    refundId: refundRef.id,
    returnId,
    disputeId,
    note: reason,
    createdBy: processedBy,
  });

  // Mirror the transaction id back onto the refund.
  await updateDoc(refundRef, { transactionId }).catch(() => null);

  // Patch the order's cross-refs + refundedAmount. `increment` is atomic
  // so concurrent partial refunds don't trample each other.
  await updateDoc(doc(firestore, 'orders', order.id), {
    refundIds: arrayUnion(refundRef.id),
    refundedAmount: increment(Math.max(0, amount)),
    updatedAt: serverTimestamp(),
  }).catch((e) => {
    // Order patch is best-effort; the ledger + refund doc are the source of truth.
    console.warn('[order-lifecycle] order cross-ref patch failed', e);
  });

  return { refundId: refundRef.id, transactionId };
}

/**
 * Record a return request. Creates the return doc and patches order cross-refs.
 * No ledger row yet — the refund (and its transaction) is written later, when
 * the return is received and processed via recordRefundForReturn().
 */
export async function recordReturn(args: {
  firestore: Firestore;
  order: FirestoreOrder;
  reason: string;
  type?: 'return' | 'exchange';
  disputeId?: string;
  buyerName?: string;
  processedBy?: string;
}): Promise<{ returnId: string }> {
  const { firestore, order, reason, type, disputeId, buyerName, processedBy } = args;
  const items = (order.items || []).map((i) => ({
    id: i.id,
    title: i.title,
    price: i.price,
    image: i.image,
  }));
  const returnDoc: Record<string, any> = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    buyerId: order.buyerId,
    buyerName: buyerName || 'Buyer',
    sellerId: items[0]?.id ? order.items?.[0]?.sellerId : (order.sellerIds?.[0] || ''),
    items,
    type: type || 'return',
    reason,
    status: 'approved',
    processedBy: processedBy || 'admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    disputeId,
  };
  for (const k of Object.keys(returnDoc)) if (returnDoc[k] === undefined) delete returnDoc[k];
  const returnRef = await addDoc(collection(firestore, 'returns'), returnDoc);

  await updateDoc(doc(firestore, 'orders', order.id), {
    returnIds: arrayUnion(returnRef.id),
    updatedAt: serverTimestamp(),
  }).catch((e) => console.warn('[order-lifecycle] order cross-ref patch failed', e));

  return { returnId: returnRef.id };
}

/**
 * Process a refund triggered by a received return. Convenience wrapper around
 * recordRefund() that auto-fills the amount from the return's items and
 * mirrors the refund id onto the return doc.
 */
export async function recordRefundForReturn(args: {
  firestore: Firestore;
  order: FirestoreOrder;
  returnDoc: FirestoreReturn;
  processedBy?: string;
  processedByName?: string;
}): Promise<{ refundId: string; transactionId: string }> {
  const { firestore, order, returnDoc: ret, processedBy, processedByName } = args;
  const amount = (ret.items || []).reduce((s, it) => s + (Number(it.price) || 0), 0);
  const { refundId, transactionId } = await recordRefund({
    firestore,
    order,
    amount,
    reason: ret.reason || 'Return processed',
    type: amount >= order.totalAmount ? 'full' : 'partial',
    disputeId: ret.disputeId,
    returnId: ret.id,
    processedBy,
    processedByName,
  });
  // Mirror the refund id back onto the return.
  await updateDoc(doc(firestore, 'returns', ret.id), {
    refundId,
    status: 'refunded',
    updatedAt: serverTimestamp(),
  }).catch((e) => console.warn('[order-lifecycle] return patch failed', e));
  return { refundId, transactionId };
}

/**
 * Process a refund triggered by a resolved dispute. Convenience wrapper that
 * mirrors the refund id back onto the dispute doc.
 */
export async function recordRefundForDispute(args: {
  firestore: Firestore;
  order: FirestoreOrder;
  dispute: FirestoreDispute;
  amount?: number; // defaults to order.totalAmount
  reason?: string;
  type?: 'full' | 'partial' | 'cancellation';
  processedBy?: string;
  processedByName?: string;
}): Promise<{ refundId: string; transactionId: string }> {
  const { firestore, order, dispute, amount, reason, type, processedBy, processedByName } = args;
  const final = amount ?? order.totalAmount;
  const { refundId, transactionId } = await recordRefund({
    firestore,
    order,
    amount: final,
    reason: reason || dispute.reason || dispute.resolution || 'Dispute resolved',
    type: type || (final >= order.totalAmount ? 'full' : 'partial'),
    disputeId: dispute.id,
    processedBy,
    processedByName,
  });
  await updateDoc(doc(firestore, 'disputes', dispute.id), {
    refundId,
    updatedAt: serverTimestamp(),
  }).catch((e) => console.warn('[order-lifecycle] dispute patch failed', e));
  return { refundId, transactionId };
}

/** Load an order by id. Returns null if missing. Caller decides how to react. */
export async function loadOrder(firestore: Firestore, orderId: string): Promise<FirestoreOrder | null> {
  const snap = await getDoc(doc(firestore, 'orders', orderId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as FirestoreOrder) : null;
}
