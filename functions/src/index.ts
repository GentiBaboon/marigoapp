
import * as admin from "firebase-admin";
import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";

initializeApp();
const db = admin.firestore();

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) {
    throw new HttpsError("failed-precondition", "STRIPE_SECRET_KEY missing on server.");
  }
  return new Stripe(key, {
    apiVersion: "2024-06-20",
  });
};

/**
 * Scheduled job to update exchange rates daily
 */
export const updateExchangeRates = onSchedule("every 24 hours", async (event) => {
    try {
        const response = await fetch(`https://open.er-api.com/v6/latest/EUR`);
        const data = await response.json();

        if (data.result === "success") {
            const rates = {
                EUR: 1,
                ALL: data.rates.ALL,
                USD: data.rates.USD
            };

            await db.collection("config").doc("exchangeRates").set({
                base: "EUR",
                rates: rates,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            logger.info("Exchange rates updated", rates);
        }
    } catch (error) {
        logger.error("Exchange rates update failed", error);
    }
});

/**
 * Order Automation Trigger
 */
export const onOrderUpdateTrigger = onDocumentUpdated("orders/{orderId}", async (event) => {
  const newValue = event.data?.after.data();
  const previousValue = event.data?.before.data();

  if (!newValue || !previousValue) return;

  const orderId = event.params.orderId;
  const newStatus = newValue.status;
  const oldStatus = previousValue.status;

  if (newStatus === oldStatus) return;

  const buyerId = newValue.buyerId;
  const sellerId = newValue.sellerIds[0];
  const orderNumber = newValue.orderNumber;

  const notify = async (userId: string, title: string, message: string, type: string) => {
      await db.collection("notifications").add({
          userId, title, message, type, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: { orderId, link: `/profile/orders/${orderId}` }
      });
  };

  switch (newStatus) {
    case "paid":
      await notify(sellerId, "New Order Received!", `Order #${orderNumber} is ready for shipping.`, "item_sold");
      break;
    case "shipped":
      await notify(buyerId, "Your order is on the way!", `Order #${orderNumber} has been shipped.`, "order_update");
      break;
    case "delivered":
      await notify(buyerId, "Order Delivered", `Please confirm receipt for Order #${orderNumber}.`, "order_update");
      break;
    case "completed":
      await notify(sellerId, "Payment Released", `Funds for Order #${orderNumber} are now available.`, "payment_received");
      break;
  }
});

/**
 * Creates a Stripe Express Connected Account
 */
export const createStripeConnectedAccount = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
  const stripe = getStripe();
  const uid = request.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    let accountId = userDoc.data()?.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: request.auth.token.email,
        capabilities: { card_payments: {requested: true}, transfers: {requested: true} },
        metadata: { userId: uid }
      });
      accountId = account.id;
      await db.collection("users").doc(uid).update({ stripeAccountId: accountId, isSeller: true });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.APP_URL}/profile/stripe-onboarding`,
      return_url: `${process.env.APP_URL}/profile`,
      type: "account_onboarding",
    });

    return {url: accountLink.url};
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Helper to calculate final order amounts securely on the server
 */
async function calculateOrderTotal(items: any[], couponCode?: string) {
    let subtotal = 0;
    const sellerIds = new Set<string>();
    
    for (const item of items) {
        const pSnap = await db.collection("products").doc(item.id).get();
        if (!pSnap.exists || pSnap.data()?.status !== 'active') {
            throw new HttpsError("failed-precondition", `Item ${item.title} is no longer available.`);
        }
        const pData = pSnap.data();
        subtotal += pData?.price || 0;
        if (pData?.sellerId) sellerIds.add(pData.sellerId);
    }

    // Check Promotions
    const settingsSnap = await db.collection("settings").doc("global").get();
    const settings = settingsSnap.data();
    let shippingFee = 10.90;
    if (settings?.isFreeDeliveryActive && subtotal >= (settings?.freeDeliveryThreshold || 0)) {
        shippingFee = 0;
    }

    // Apply Coupon
    let discount = 0;
    if (couponCode) {
        const cSnap = await db.collection("coupons").where("code", "==", couponCode.toUpperCase()).limit(1).get();
        if (!cSnap.empty) {
            const coupon = cSnap.docs[0].data();
            if (coupon.isActive && subtotal >= (coupon.minOrderValue || 0)) {
                if (coupon.type === 'percentage') {
                    discount = (subtotal * coupon.value) / 100;
                } else {
                    discount = coupon.value;
                }
            }
        }
    }

    const total = Math.max(0, subtotal + shippingFee - discount);
    
    return {
        subtotal,
        shippingFee,
        discount,
        total,
        sellerIds: Array.from(sellerIds)
    };
}

/**
 * Creates PaymentIntent with manual capture for Escrow
 */
export const createPaymentIntent = onCall({secrets: ["STRIPE_SECRET_KEY"], minInstances: 1}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  
  const {items, shippingAddress, paymentMethodId, couponCode} = request.data;
  const stripe = getStripe();
  const buyerId = request.auth.uid;

  try {
    const { total, sellerIds, discount } = await calculateOrderTotal(items, couponCode);
    const totalInCents = Math.round(total * 100);

    // Get Buyer's Stripe Customer ID if they have one
    const buyerSnap = await db.collection("users").doc(buyerId).get();
    const customerId = buyerSnap.data()?.stripeCustomerId;

    const piOptions: Stripe.PaymentIntentCreateParams = {
      amount: totalInCents,
      currency: "eur",
      capture_method: "manual",
      metadata: { buyerId, sellerIds: sellerIds.join(',') },
      description: `Order for ${items.length} items from Marigo Luxe`
    };

    if (customerId) {
        piOptions.customer = customerId;
    }

    if (paymentMethodId) {
        piOptions.payment_method = paymentMethodId;
    }

    const pi = await stripe.paymentIntents.create(piOptions);

    const orderRef = await db.collection("orders").add({
      orderNumber: `MG-${Date.now()}`,
      buyerId,
      sellerIds,
      items,
      totalAmount: total,
      discountAmount: discount,
      couponCode: couponCode || null,
      status: "pending_payment",
      paymentIntentId: pi.id,
      paymentMethod: 'card',
      shippingAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {clientSecret: pi.client_secret, orderId: orderRef.id};
  } catch (error: any) {
    logger.error("createPaymentIntent error", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Creates a standard order (e.g. for Cash on Delivery)
 */
export const createOrder = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  
  const {items, shippingAddress, paymentMethod, couponCode} = request.data;
  const buyerId = request.auth.uid;

  try {
    const { total, sellerIds, discount } = await calculateOrderTotal(items, couponCode);

    const orderRef = await db.collection("orders").add({
      orderNumber: `MG-${Date.now()}`,
      buyerId,
      sellerIds,
      items,
      totalAmount: total,
      discountAmount: discount,
      couponCode: couponCode || null,
      status: paymentMethod === 'cod' ? 'processing' : 'pending_payment',
      paymentMethod,
      shippingAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {orderId: orderRef.id};
  } catch (error: any) {
    logger.error("createOrder error", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Scheduled job to release funds after 72h of delivery
 */
export const releaseEscrow = onSchedule("every 1 hours", async (event) => {
    const stripe = getStripe();
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - 72);

    const orders = await db.collection("orders")
        .where("status", "==", "delivered")
        .where("deliveredAt", "<=", threshold)
        .get();

    for (const doc of orders.docs) {
        const order = doc.data();
        if (order.paymentIntentId) {
            try {
                await stripe.paymentIntents.capture(order.paymentIntentId);
                await doc.ref.update({ status: "completed" });
            } catch (e) {
                logger.error(`Escrow release failed: ${doc.id}`, e);
            }
        }
    }
});
