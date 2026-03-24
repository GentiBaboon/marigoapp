import * as admin from "firebase-admin";
import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError, onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";

initializeApp();
const db = admin.firestore();

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key || key === "sk_test_your_key_here") {
    throw new HttpsError("failed-precondition", "STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(key, {
    apiVersion: "2024-06-20",
  });
};

// ═══════════════════════════════════════════════════════
// ORDER AUTOMATION TRIGGER
// ═══════════════════════════════════════════════════════
export const onOrderUpdateTrigger = onDocumentUpdated("orders/{orderId}", async (event) => {
  const newValue = event.data?.after.data();
  const previousValue = event.data?.before.data();

  if (!newValue || !previousValue) return;

  const orderId = event.params.orderId;
  const newStatus = newValue.status;
  const oldStatus = previousValue.status;

  if (newStatus === oldStatus) return;

  const buyerId = newValue.buyerId;
  const sellerId = newValue.sellerIds?.[0];
  const orderNumber = newValue.orderNumber;

  // 1. Manage Product Inventory Status
  if (["paid", "processing", "shipped"].includes(newStatus) && !["paid", "processing", "shipped"].includes(oldStatus)) {
    const items = newValue.items || [];
    const batch = db.batch();
    items.forEach((item: any) => {
      const productRef = db.collection("products").doc(item.id);
      batch.update(productRef, {status: "sold", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
    });
    await batch.commit();
  }

  // 2. Release products back if cancelled/refunded
  if (["cancelled", "refunded"].includes(newStatus)) {
    const items = newValue.items || [];
    const batch = db.batch();
    items.forEach((item: any) => {
      const productRef = db.collection("products").doc(item.id);
      batch.update(productRef, {status: "active", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
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

// ═══════════════════════════════════════════════════════
// CREATE PAYMENT INTENT (Card Payments - Escrow)
// ═══════════════════════════════════════════════════════
export const createPaymentIntent = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");

  const {items, shippingAddress, paymentMethodId, couponCode} = request.data;
  const stripe = getStripe();
  const buyerId = request.auth.uid;

  try {
    const {total, sellerIds, discount, validatedItems} = await calculateOrderTotal(items, couponCode);
    const totalInCents = Math.round(total * 100);

    if (totalInCents < 50) {
      throw new HttpsError("invalid-argument", "Order total must be at least €0.50");
    }

    // Get or create Stripe customer
    const buyerSnap = await db.collection("users").doc(buyerId).get();
    let customerId = buyerSnap.data()?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: buyerSnap.data()?.email || undefined,
        name: buyerSnap.data()?.name || undefined,
        metadata: {firebaseUid: buyerId},
      });
      customerId = customer.id;
      await db.collection("users").doc(buyerId).update({stripeCustomerId: customerId});
    }

    const orderNumber = `MG-${Date.now()}`;

    const piOptions: Stripe.PaymentIntentCreateParams = {
      amount: totalInCents,
      currency: "eur",
      capture_method: "manual", // ESCROW: Hold funds, capture later
      customer: customerId,
      metadata: {
        buyerId,
        sellerIds: sellerIds.join(","),
        orderNumber,
        itemCount: String(items.length),
      },
      description: `Marigo Luxe Purchase - ${orderNumber}`,
    };

    if (paymentMethodId) {
      piOptions.payment_method = paymentMethodId;
    }

    const pi = await stripe.paymentIntents.create(piOptions);

    // Reserve products
    const batch = db.batch();
    for (const item of items) {
      batch.update(db.collection("products").doc(item.id), {status: "reserved"});
    }

    // Create order
    const orderRef = db.collection("orders").doc();
    batch.set(orderRef, {
      orderNumber,
      buyerId,
      sellerIds,
      items: validatedItems,
      totalAmount: total,
      discountAmount: discount,
      couponCode: couponCode || null,
      status: "pending_payment",
      paymentIntentId: pi.id,
      paymentMethod: "card",
      shippingAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {clientSecret: pi.client_secret, orderId: orderRef.id};
  } catch (error: any) {
    logger.error("createPaymentIntent error", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Payment processing failed. Please try again.");
  }
});

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
    logger.error("createOrder error", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Order creation failed.");
  }
});

// ═══════════════════════════════════════════════════════
// STRIPE WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════
export const handleStripeWebhook = onRequest({region: "europe-west1"}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
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
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      // Find order by paymentIntentId
      const orderSnap = await db.collection("orders").where("paymentIntentId", "==", pi.id).limit(1).get();
      if (!orderSnap.empty) {
        const orderDoc = orderSnap.docs[0];
        if (orderDoc.data().status === "pending_payment") {
          await orderDoc.ref.update({
            status: "processing",
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderSnap = await db.collection("orders").where("paymentIntentId", "==", pi.id).limit(1).get();
      if (!orderSnap.empty) {
        const orderDoc = orderSnap.docs[0];
        await orderDoc.ref.update({
          status: "cancelled",
          failureReason: pi.last_payment_error?.message || "Payment failed",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const piId = charge.payment_intent as string;
      if (piId) {
        const orderSnap = await db.collection("orders").where("paymentIntentId", "==", piId).limit(1).get();
        if (!orderSnap.empty) {
          await orderSnap.docs[0].ref.update({
            status: "refunded",
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
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
export const capturePayment = onCall({region: "europe-west1"}, async (request) => {
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

    // Capture the held funds
    const pi = await stripe.paymentIntents.capture(order.paymentIntentId);

    await orderDoc.ref.update({
      status: "completed",
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      capturedAmount: pi.amount_received / 100,
    });

    return {success: true, capturedAmount: pi.amount_received / 100};
  } catch (error: any) {
    logger.error("capturePayment error", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message);
  }
});

// ═══════════════════════════════════════════════════════
// PROCESS REFUND (Admin only)
// ═══════════════════════════════════════════════════════
export const processRefund = onCall({region: "europe-west1"}, async (request) => {
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
}, async () => {
  const stripe = getStripe();
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72 hours ago

  try {
    const ordersSnap = await db.collection("orders")
      .where("status", "==", "delivered")
      .where("paymentMethod", "==", "card")
      .get();

    let capturedCount = 0;

    for (const doc of ordersSnap.docs) {
      const order = doc.data();

      // Check if delivered more than 72 hours ago
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

        capturedCount++;
        logger.info(`Auto-captured payment for order ${doc.id}`);
      } catch (err: any) {
        logger.error(`Failed to capture order ${doc.id}:`, err.message);
      }
    }

    logger.info(`Escrow release complete. Captured ${capturedCount} orders.`);
  } catch (error: any) {
    logger.error("releaseEscrow error", error);
  }
});

// ═══════════════════════════════════════════════════════
// STRIPE CONNECT - Create Connected Account for Sellers
// ═══════════════════════════════════════════════════════
export const createStripeConnectedAccount = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");

  const stripe = getStripe();
  const uid = request.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();

    // Check if already has an account
    if (userData?.stripeAccountId) {
      // Return new onboarding link if not fully onboarded
      const link = await stripe.accountLinks.create({
        account: userData.stripeAccountId,
        refresh_url: `${request.data.baseUrl || "https://marigo10.vercel.app"}/profile/seller/onboarding?refresh=true`,
        return_url: `${request.data.baseUrl || "https://marigo10.vercel.app"}/profile/seller/onboarding?success=true`,
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

    // Save to Firestore
    await db.collection("users").doc(uid).update({
      stripeAccountId: account.id,
      isSeller: true,
    });

    // Create onboarding link
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${request.data.baseUrl || "https://marigo10.vercel.app"}/profile/seller/onboarding?refresh=true`,
      return_url: `${request.data.baseUrl || "https://marigo10.vercel.app"}/profile/seller/onboarding?success=true`,
      type: "account_onboarding",
    });

    return {accountId: account.id, onboardingUrl: link.url};
  } catch (error: any) {
    logger.error("createStripeConnectedAccount error", error);
    throw new HttpsError("internal", error.message);
  }
});

// ═══════════════════════════════════════════════════════
// SELLER BALANCE & PAYOUTS
// ═══════════════════════════════════════════════════════
export const getSellerBalance = onCall({region: "europe-west1"}, async (request) => {
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

export const requestPayout = onCall({region: "europe-west1"}, async (request) => {
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
