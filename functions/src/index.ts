
import * as admin from "firebase-admin";
import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onRequest} from "firebase-functions/v2/https";
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
 * Creates PaymentIntent with manual capture for Escrow
 */
export const createPaymentIntent = onCall({secrets: ["STRIPE_SECRET_KEY"], minInstances: 1}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  
  const {items, shippingAddress} = request.data;
  const stripe = getStripe();
  const buyerId = request.auth.uid;

  try {
    const sellerId = items[0].sellerId;
    const sellerSnap = await db.collection("users").doc(sellerId).get();
    const sellerData = sellerSnap.data();

    let subtotal = 0;
    for (const item of items) {
      const pSnap = await db.collection("products").doc(item.id).get();
      if (!pSnap.exists || pSnap.data()?.status !== 'active') throw new HttpsError("failed-precondition", "Item unavailable.");
      subtotal += pSnap.data()?.price;
    }

    const totalInCents = Math.round((subtotal + 5.00) * 100);
    const commission = Math.round(totalInCents * 0.15);

    const pi = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: "eur",
      capture_method: "manual",
      transfer_data: sellerData?.stripeAccountId ? { 
          destination: sellerData.stripeAccountId,
          amount: totalInCents - commission 
      } : undefined,
      metadata: { buyerId, sellerId }
    });

    const orderRef = await db.collection("orders").add({
      orderNumber: `MG-${Date.now()}`,
      buyerId,
      sellerIds: [sellerId],
      items,
      totalAmount: subtotal + 5.00,
      status: "pending_payment",
      paymentIntentId: pi.id,
      shippingAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {clientSecret: pi.client_secret, orderId: orderRef.id};
  } catch (error: any) {
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
