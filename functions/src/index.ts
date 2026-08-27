import * as admin from "firebase-admin";
import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError, onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";

// Secrets pulled from Google Secret Manager at runtime. Bind these on each
// function that needs them via { secrets: [...] }.
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WH_SECRET = defineSecret("STRIPE_WH_SECRET");
const APP_URL_PARAM = defineSecret("APP_URL");

initializeApp();
const db = admin.firestore();

const getStripe = () => {
  const key = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
  if (!key) {
    logger.error("Stripe secret key is missing. Check functions/.env file and redeploy.");
    throw new HttpsError("failed-precondition", "Payment service is not configured. Please contact support.");
  }
  return new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
};

// Defaults mirror src/lib/types.ts (DEFAULT_*). Keep these in sync.
const DEFAULT_PAYOUT_HOLD_HOURS = 72;
const DEFAULT_COMMISSION_RATE = 0.15;

/** Read settings/global once and return a normalized config with defaults
 *  applied. Returns sane defaults if the doc is missing so callers don't
 *  have to handle the empty case. */
async function getPlatformSettings(): Promise<{
  commissionRate: number;
  payoutHoldHours: number;
}> {
  const snap = await db.collection("settings").doc("global").get();
  const data = snap.exists ? (snap.data() as any) : {};
  return {
    commissionRate: typeof data?.commissionRate === "number" ? data.commissionRate : DEFAULT_COMMISSION_RATE,
    payoutHoldHours: typeof data?.payoutHoldHours === "number" ? data.payoutHoldHours : DEFAULT_PAYOUT_HOLD_HOURS,
  };
}

/** Split an order's captured funds among its sellers and transfer each
 *  seller their net (subtotal × (1 - commissionRate)) into their connected
 *  Stripe account. Also writes one ledger row per movement.
 *
 *  Skips sellers without a stripeAccountId — those payouts are flagged on
 *  the order so an admin can settle them manually offline.
 *
 *  Idempotent on (orderId, sellerId) via a transferKey. Safe to call twice
 *  if a capture retries — the second call no-ops for sellers already paid.
 */
async function distributeOrderToSellers(params: {
  orderId: string;
  order: FirebaseFirestore.DocumentData;
  stripe: Stripe;
}): Promise<{transferred: number; skipped: string[]}> {
  const {orderId, order, stripe} = params;
  const {commissionRate} = await getPlatformSettings();
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const sellerIds: string[] = Array.isArray(order.sellerIds) ? order.sellerIds : [];
  const orderNumber: string = order.orderNumber || orderId;

  let transferredCents = 0;
  const skipped: string[] = [];

  // Track which sellers already received a transfer for this order so retries
  // are idempotent. Stored on the order doc as `payouts: { [sellerId]: ... }`.
  const existingPayouts: Record<string, any> = order.payouts || {};

  for (const sellerId of sellerIds) {
    if (existingPayouts[sellerId]?.transferId) continue; // already paid

    const sellerItems = items.filter((it: any) => it?.sellerId === sellerId);
    const sellerSubtotal = sellerItems.reduce((s, it: any) => s + (Number(it?.price) || 0), 0);
    if (sellerSubtotal <= 0) continue;

    const sellerNetCents = Math.round(sellerSubtotal * (1 - commissionRate) * 100);
    const commissionCents = Math.round(sellerSubtotal * commissionRate * 100);

    // Look up seller's connected account.
    const sellerSnap = await db.collection("users").doc(sellerId).get();
    const stripeAccountId = sellerSnap.data()?.stripeAccountId;

    if (!stripeAccountId) {
      // No Connect account — record the obligation and let admin settle.
      skipped.push(sellerId);
      await db.collection("orders").doc(orderId).update({
        [`payouts.${sellerId}`]: {
          status: "manual_payout_required",
          amount: sellerNetCents / 100,
          commission: commissionCents / 100,
          recordedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
      await db.collection("transactions").add({
        type: "sale",
        orderId,
        orderNumber,
        userId: sellerId,
        amount: sellerSubtotal,
        commission: commissionCents / 100,
        sellerPayout: sellerNetCents / 100,
        paymentMethod: order.paymentMethod || "card",
        note: "Sale recorded; seller has no Stripe Connect account — pending manual payout",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.warn(`No stripeAccountId for seller ${sellerId} on order ${orderId} — flagged for manual payout`);
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: sellerNetCents,
        currency: order.currency || "eur",
        destination: stripeAccountId,
        transfer_group: `order_${orderId}`,
        description: `Marigo payout — Order ${orderNumber}`,
        metadata: {orderId, orderNumber, sellerId, commissionCents: String(commissionCents)},
      }, {
        // Idempotency key prevents double-transfer on webhook retry.
        idempotencyKey: `payout_${orderId}_${sellerId}`,
      });

      transferredCents += sellerNetCents;

      // Record on the order + write a ledger row.
      await db.collection("orders").doc(orderId).update({
        [`payouts.${sellerId}`]: {
          status: "paid",
          transferId: transfer.id,
          amount: sellerNetCents / 100,
          commission: commissionCents / 100,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
      await db.collection("transactions").add({
        type: "sale",
        orderId,
        orderNumber,
        userId: sellerId,
        amount: sellerSubtotal,
        commission: commissionCents / 100,
        sellerPayout: sellerNetCents / 100,
        paymentMethod: order.paymentMethod || "card",
        note: `Stripe transfer ${transfer.id}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err: any) {
      logger.error(`Transfer to seller ${sellerId} for order ${orderId} failed`, err.message);
      skipped.push(sellerId);
      await db.collection("orders").doc(orderId).update({
        [`payouts.${sellerId}`]: {
          status: "failed",
          error: err.message,
          attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    }
  }

  return {transferred: transferredCents / 100, skipped};
}

// ═══════════════════════════════════════════════════════
// UPDATE ORDER STATUS (Called by admin/system)
// ═══════════════════════════════════════════════════════
export const updateOrderStatus = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");

  const {orderId, newStatus} = request.data;
  if (!orderId || !newStatus) throw new HttpsError("invalid-argument", "orderId and newStatus required.");

  const orderDoc = await db.collection("orders").doc(orderId).get();
  const order = orderDoc.data();
  if (!order) throw new HttpsError("not-found", "Order not found.");

  const oldStatus = order.status;
  const buyerId = order.buyerId;
  const sellerId = order.sellerIds?.[0];
  const orderNumber = order.orderNumber;

  // Update order status
  await orderDoc.ref.update({
    status: newStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 1. On completion, only flip out-of-stock listings to "sold". Listings
  //    with remaining stock stay "active" so other buyers can keep ordering
  //    the remaining units. Stock was decremented at checkout time.
  if (newStatus === "completed" && oldStatus !== "completed") {
    const batch = db.batch();
    for (const item of (order.items || [])) {
      const ref = db.collection("products").doc(item.id);
      const snap = await ref.get();
      const data = snap.exists ? (snap.data() as any) : null;
      if (data && (data.quantity ?? 0) <= 0 && data.status !== "sold") {
        batch.update(ref, {status: "sold", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
      }
    }
    await batch.commit();
  }

  // 2. Cancelled/refunded → restore stock and re-list each item. Uses
  //    increment(qty) so concurrent restocks don't clobber each other.
  if (["cancelled", "refunded"].includes(newStatus) && !["cancelled", "refunded"].includes(oldStatus)) {
    const batch = db.batch();
    (order.items || []).forEach((item: any) => {
      const qty = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
      batch.update(db.collection("products").doc(item.id), {
        quantity: admin.firestore.FieldValue.increment(qty),
        status: "active",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  // 3. Notifications
  const notify = async (userId: string, title: string, message: string, type: string) => {
    await db.collection("notifications").add({
      userId, title, message, type, read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      data: {orderId, link: `/profile/orders/${orderId}`},
    });
  };

  switch (newStatus) {
  case "paid":
  case "processing":
    if (sellerId) await notify(sellerId, "Item Sold!", `Order #${orderNumber} is confirmed. Please prepare for shipping.`, "item_sold");
    break;
  case "shipped":
    await notify(buyerId, "Item Shipped!", `Order #${orderNumber} is on its way.`, "order_update");
    break;
  case "delivered":
    await notify(buyerId, "Order Delivered", `Please confirm receipt for Order #${orderNumber}.`, "order_update");
    break;
  case "completed":
    if (sellerId) await notify(sellerId, "Payment Released", `Funds for Order #${orderNumber} are now available in your balance.`, "payment_received");
    break;
  case "cancelled":
    await notify(buyerId, "Order Cancelled", `Order #${orderNumber} has been cancelled.`, "order_update");
    break;
  case "refunded":
    await notify(buyerId, "Refund Processed", `Your refund for Order #${orderNumber} has been processed.`, "order_update");
    break;
  }

  return {success: true, oldStatus, newStatus};
});

// ═══════════════════════════════════════════════════════
// SECURE CALCULATION HELPER
// ═══════════════════════════════════════════════════════
async function calculateOrderTotal(items: any[], couponCode?: string) {
  let subtotal = 0;
  const sellerIds = new Set<string>();
  const validatedItems: any[] = [];

  for (const item of items) {
    const pSnap = await db.collection("products").doc(item.id).get();
    const pData = pSnap.data();

    if (!pSnap.exists || !["active", "reserved"].includes(pData?.status)) {
      throw new HttpsError("failed-precondition", `Item "${item.title}" is no longer available.`);
    }

    subtotal += pData?.price || 0;
    if (pData?.sellerId) sellerIds.add(pData.sellerId);
    validatedItems.push({...item, price: pData?.price || item.price});
  }

  // Shipping fee logic
  const settingsSnap = await db.collection("settings").doc("global").get();
  const settings = settingsSnap.data();
  let shippingFee = items.length * 10.90;
  if (settings?.isFreeDeliveryActive && subtotal >= (settings?.freeDeliveryThreshold || 0)) {
    shippingFee = 0;
  }

  // Coupon logic
  let discount = 0;
  if (couponCode) {
    const cSnap = await db.collection("coupons").where("code", "==", couponCode.toUpperCase()).limit(1).get();
    if (!cSnap.empty) {
      const coupon = cSnap.docs[0].data();
      if (coupon.isActive && subtotal >= (coupon.minOrderValue || 0)) {
        discount = coupon.type === "percentage" ? (subtotal * coupon.value) / 100 : coupon.value;
        // Increment usage
        await cSnap.docs[0].ref.update({usedCount: admin.firestore.FieldValue.increment(1)});
      }
    }
  }

  const total = Math.max(0, subtotal + shippingFee - discount);

  return {subtotal, shippingFee, discount, total, sellerIds: Array.from(sellerIds), validatedItems};
}

// The callable `createPaymentIntent` was removed. Card checkout goes through
// /api/create-payment-intent and /api/confirm-order in the Next app, which is
// what the client has always called — nothing ever invoked this one. It also
// still carried the original bug those routes were fixed for: it reserved
// every product unconditionally, before the card was confirmed and without
// checking stock, so an abandoned checkout stranded the listing.

// ═══════════════════════════════════════════════════════
// CREATE ORDER (Cash on Delivery)
// ═══════════════════════════════════════════════════════
export const createOrder = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");

  const {items, shippingAddress, couponCode} = request.data;
  const buyerId = request.auth.uid;

  try {
    const {total, sellerIds, discount, validatedItems} = await calculateOrderTotal(items, couponCode);

    const orderRef = await db.collection("orders").add({
      orderNumber: `MG-COD-${Date.now()}`,
      buyerId,
      sellerIds,
      items: validatedItems,
      totalAmount: total,
      discountAmount: discount,
      couponCode: couponCode || null,
      status: "processing", // COD moves straight to processing
      paymentMethod: "cod",
      shippingAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {success: true, orderId: orderRef.id};
  } catch (error: any) {
    logger.error("createOrder error", {message: error.message, code: error.code});
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Order creation failed. Please try again.");
  }
});

// ═══════════════════════════════════════════════════════
// STRIPE WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════
export const handleStripeWebhook = onRequest({region: "europe-west1", secrets: [STRIPE_SECRET_KEY, STRIPE_WH_SECRET]}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WH_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "";
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err: any) {
    logger.error("Webhook signature verification failed", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
    // With capture_method:'manual', this fires when the buyer's card has
    // been authorized — funds are held but not yet captured. Treat this
    // as "payment confirmed" and move the order to processing.
    case "payment_intent.amount_capturable_updated":
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderSnap = await db.collection("orders").where("paymentIntentId", "==", pi.id).limit(1).get();
      if (!orderSnap.empty) {
        const orderDoc = orderSnap.docs[0];
        const data = orderDoc.data();
        if (data.status === "pending_payment") {
          await orderDoc.ref.update({
            status: "processing",
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        // If this was a full-capture event (not just auth), and we haven't
        // distributed yet, run the per-seller split now.
        if (event.type === "payment_intent.succeeded" && pi.amount_received > 0 && !data.payouts) {
          const fresh = (await orderDoc.ref.get()).data() || data;
          await distributeOrderToSellers({orderId: orderDoc.id, order: fresh, stripe});
        }
      }
      break;
    }

    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderSnap = await db.collection("orders").where("paymentIntentId", "==", pi.id).limit(1).get();
      if (!orderSnap.empty) {
        const orderDoc = orderSnap.docs[0];
        const data = orderDoc.data();

        // Restore stock: re-increment quantities and re-list any item that
        // was flipped to `reserved` because we ran it down to zero at
        // checkout. Mirrors the inverse of create-payment-intent's stock
        // decrement step.
        const items: any[] = Array.isArray(data.items) ? data.items : [];
        const batch = db.batch();
        for (const item of items) {
          const ref = db.collection("products").doc(item.id || item.productId);
          const snap = await ref.get();
          if (!snap.exists) continue;
          const p = snap.data() as any;
          const orderedQty = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
          const newQty = Math.max(0, Number(p.quantity || 0)) + orderedQty;
          const update: Record<string, unknown> = {
            quantity: newQty,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          if (p.status === "reserved") update.status = "active";

          // Restore variant stock if applicable.
          const variants = Array.isArray(p.variants) ? p.variants : null;
          const itemSize = item.selectedSize || item.size;
          if (variants && itemSize) {
            update.variants = variants.map((v: any) =>
              v?.size === itemSize ? {...v, quantity: Math.max(0, (Number(v.quantity) || 0) + orderedQty)} : v
            );
          }
          batch.update(ref, update as FirebaseFirestore.UpdateData<any>);
        }

        batch.update(orderDoc.ref, {
          status: event.type === "payment_intent.canceled" ? "cancelled" : "payment_failed",
          failureReason: pi.last_payment_error?.message || (event.type === "payment_intent.canceled" ? "Payment cancelled" : "Payment failed"),
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const piId = charge.payment_intent as string;
      if (piId) {
        const orderSnap = await db.collection("orders").where("paymentIntentId", "==", piId).limit(1).get();
        if (!orderSnap.empty) {
          const orderDoc = orderSnap.docs[0];
          const data = orderDoc.data();
          const refundCents = charge.amount_refunded;
          const refundAmount = refundCents / 100;
          const totalCents = (data.totalAmount || 0) * 100;
          const isFull = Math.abs(refundCents - totalCents) < 1;

          await orderDoc.ref.update({
            status: "refunded",
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            refundedAmount: refundAmount,
          });

          // Append a negative ledger row so /admin/finance reconciles.
          await db.collection("transactions").add({
            type: isFull ? "refund" : "partial_refund",
            orderId: orderDoc.id,
            orderNumber: data.orderNumber,
            userId: data.buyerId,
            amount: -refundAmount,
            commission: 0,
            sellerPayout: 0,
            paymentMethod: data.paymentMethod || "card",
            note: `Stripe refund on charge ${charge.id}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      break;
    }

    default:
      logger.info(`Unhandled webhook event: ${event.type}`);
    }
  } catch (err: any) {
    logger.error("Error processing webhook", err);
  }

  res.status(200).json({received: true});
});

// ═══════════════════════════════════════════════════════
// CAPTURE PAYMENT (Admin/System - Escrow Release)
// ═══════════════════════════════════════════════════════
export const capturePayment = onCall({region: "europe-west1", secrets: [STRIPE_SECRET_KEY]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");

  const {orderId} = request.data;
  if (!orderId) throw new HttpsError("invalid-argument", "orderId is required.");

  try {
    const stripe = getStripe();
    const orderDoc = await db.collection("orders").doc(orderId).get();
    const order = orderDoc.data();

    if (!order) throw new HttpsError("not-found", "Order not found.");
    if (!order.paymentIntentId) throw new HttpsError("failed-precondition", "No payment intent for this order.");
    if (!["delivered", "processing", "shipped"].includes(order.status)) {
      throw new HttpsError("failed-precondition", `Cannot capture payment for order in status: ${order.status}`);
    }

    // Capture the held funds into the platform account.
    const pi = await stripe.paymentIntents.capture(order.paymentIntentId);

    await orderDoc.ref.update({
      status: "completed",
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      capturedAmount: pi.amount_received / 100,
    });

    // Now split funds out to each seller's Connect account.
    const fresh = (await orderDoc.ref.get()).data() || order;
    const dist = await distributeOrderToSellers({orderId, order: fresh, stripe});

    return {
      success: true,
      capturedAmount: pi.amount_received / 100,
      sellerPayoutAmount: dist.transferred,
      sellersPendingManualPayout: dist.skipped,
    };
  } catch (error: any) {
    logger.error("capturePayment error", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message);
  }
});

// ═══════════════════════════════════════════════════════
// PROCESS REFUND (Admin only)
// ═══════════════════════════════════════════════════════
export const processRefund = onCall({region: "europe-west1", secrets: [STRIPE_SECRET_KEY]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");

  const {orderId, amount, reason} = request.data;
  if (!orderId) throw new HttpsError("invalid-argument", "orderId is required.");

  try {
    // Verify admin
    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    if (userDoc.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can process refunds.");
    }

    const stripe = getStripe();
    const orderDoc = await db.collection("orders").doc(orderId).get();
    const order = orderDoc.data();

    if (!order) throw new HttpsError("not-found", "Order not found.");
    if (!order.paymentIntentId) throw new HttpsError("failed-precondition", "No payment intent for this order.");

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: order.paymentIntentId,
      reason: "requested_by_customer",
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100); // partial refund
    }

    const refund = await stripe.refunds.create(refundParams);

    await orderDoc.ref.update({
      status: "refunded",
      refundId: refund.id,
      refundAmount: (refund.amount || 0) / 100,
      refundReason: reason || "Customer request",
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {success: true, refundId: refund.id, refundAmount: (refund.amount || 0) / 100};
  } catch (error: any) {
    logger.error("processRefund error", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message);
  }
});

// ═══════════════════════════════════════════════════════
// RELEASE ESCROW (Scheduled - runs every hour)
// Auto-captures payments for delivered orders after 72 hours
// ═══════════════════════════════════════════════════════
export const releaseEscrow = onSchedule({
  schedule: "every 60 minutes",
  region: "europe-west1",
  secrets: [STRIPE_SECRET_KEY],
}, async () => {
  const stripe = getStripe();
  const {payoutHoldHours} = await getPlatformSettings();
  const cutoff = new Date(Date.now() - payoutHoldHours * 60 * 60 * 1000);

  try {
    const ordersSnap = await db.collection("orders")
      .where("status", "==", "delivered")
      .where("paymentMethod", "==", "card")
      .get();

    let capturedCount = 0;

    for (const doc of ordersSnap.docs) {
      const order = doc.data();

      // Only capture orders delivered before the cutoff.
      const deliveredAt = order.deliveredAt?.toDate?.() || order.updatedAt?.toDate?.();
      if (!deliveredAt || deliveredAt > cutoff) continue;

      if (!order.paymentIntentId) continue;

      try {
        const pi = await stripe.paymentIntents.capture(order.paymentIntentId);

        await doc.ref.update({
          status: "completed",
          capturedAt: admin.firestore.FieldValue.serverTimestamp(),
          capturedAmount: pi.amount_received / 100,
          autoReleased: true,
        });

        // Split to sellers.
        const fresh = (await doc.ref.get()).data() || order;
        await distributeOrderToSellers({orderId: doc.id, order: fresh, stripe});

        capturedCount++;
        logger.info(`Auto-captured + distributed order ${doc.id}`);
      } catch (err: any) {
        logger.error(`Failed to capture order ${doc.id}:`, err.message);
      }
    }

    logger.info(`Escrow release complete. Captured ${capturedCount} orders (hold = ${payoutHoldHours}h).`);
  } catch (error: any) {
    logger.error("releaseEscrow error", error);
  }
});

// ═══════════════════════════════════════════════════════
// STRIPE CONNECT - Create Connected Account for Sellers
// ═══════════════════════════════════════════════════════
export const createStripeConnectedAccount = onCall({region: "europe-west1", secrets: [STRIPE_SECRET_KEY, APP_URL_PARAM]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");

  const stripe = getStripe();
  const uid = request.auth.uid;

  // Resolve which origin to redirect the seller back to after Stripe
  // onboarding. Priority: data passed by the caller → APP_URL env →
  // legacy hardcoded fallback. Optional-chained so callers may omit args.
  const baseUrl =
    request.data?.baseUrl ||
    process.env.APP_URL ||
    "https://marigo10.vercel.app";

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();

    // Check if already has an account
    if (userData?.stripeAccountId) {
      // Return new onboarding link if not fully onboarded
      const link = await stripe.accountLinks.create({
        account: userData.stripeAccountId,
        refresh_url: `${baseUrl}/profile/seller/onboarding?refresh=true`,
        return_url: `${baseUrl}/profile/seller/onboarding?success=true`,
        type: "account_onboarding",
      });
      return {accountId: userData.stripeAccountId, onboardingUrl: link.url};
    }

    // Create Express Connected Account
    const account = await stripe.accounts.create({
      type: "express",
      email: userData?.email || undefined,
      metadata: {firebaseUid: uid},
      capabilities: {
        card_payments: {requested: true},
        transfers: {requested: true},
      },
    });

    // Save to Firestore. Use set+merge so the call also succeeds for users
    // whose `users/{uid}` doc doesn't exist yet (e.g. fresh sign-ups whose
    // user-doc-creation flow hasn't run, or local testing against an empty
    // Firestore emulator).
    await db.collection("users").doc(uid).set({
      stripeAccountId: account.id,
      isSeller: true,
    }, {merge: true});

    // Create onboarding link
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/profile/seller/onboarding?refresh=true`,
      return_url: `${baseUrl}/profile/seller/onboarding?success=true`,
      type: "account_onboarding",
    });

    return {accountId: account.id, onboardingUrl: link.url};
  } catch (error: any) {
    logger.error("createStripeConnectedAccount error", error);
    throw new HttpsError("internal", error.message);
  }
});

// ═══════════════════════════════════════════════════════
// PASSWORD RESET LINK GENERATOR
// Called by Next.js API — generates OOB link using Admin SDK
// Requires RESET_SERVICE_SECRET env var on both sides
// ═══════════════════════════════════════════════════════
export const sendPasswordResetLink = onRequest({region: "europe-west1"}, async (req, res) => {
  const appUrl = process.env.APP_URL || "https://marigoapp.com";
  res.set("Access-Control-Allow-Origin", appUrl);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({error: "Method Not Allowed"});
    return;
  }

  const {email, serviceSecret} = req.body;
  const expectedSecret = process.env.RESET_SERVICE_SECRET;

  if (!expectedSecret || serviceSecret !== expectedSecret) {
    res.status(401).json({error: "Unauthorized"});
    return;
  }

  if (!email || typeof email !== "string") {
    res.status(400).json({error: "Email required"});
    return;
  }

  try {
    const actionCodeSettings = {
      url: `${appUrl}/auth/reset-password`,
      handleCodeInApp: true,
    };
    const link = await admin.auth().generatePasswordResetLink(email.toLowerCase().trim(), actionCodeSettings);
    res.status(200).json({success: true, link});
  } catch (err: any) {
    if (err.code === "auth/user-not-found") {
      // Don't reveal if email exists (prevent enumeration)
      res.status(200).json({success: true});
    } else {
      logger.error("sendPasswordResetLink error", err);
      res.status(500).json({error: "Internal error"});
    }
  }
});

// ═══════════════════════════════════════════════════════
// SELLER BALANCE & PAYOUTS
// ═══════════════════════════════════════════════════════
export const getSellerBalance = onCall({region: "europe-west1", secrets: [STRIPE_SECRET_KEY]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  const stripe = getStripe();
  const uid = request.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const accountId = userDoc.data()?.stripeAccountId;
    if (!accountId) return {available: 0, pending: 0};

    const balance = await stripe.balance.retrieve({stripeAccount: accountId});
    const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
    const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

    return {available, pending};
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

export const requestPayout = onCall({region: "europe-west1", secrets: [STRIPE_SECRET_KEY]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  const stripe = getStripe();
  const uid = request.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const accountId = userDoc.data()?.stripeAccountId;
    if (!accountId) throw new HttpsError("failed-precondition", "No connected account.");

    const balance = await stripe.balance.retrieve({stripeAccount: accountId});
    const amount = balance.available.find((b) => b.currency === "eur")?.amount || 0;
    if (amount <= 0) throw new HttpsError("failed-precondition", "No funds available.");

    await stripe.payouts.create({amount, currency: "eur"}, {stripeAccount: accountId});
    return {success: true};
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});
