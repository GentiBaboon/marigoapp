import * as admin from "firebase-admin";
import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";

// Initialize Firebase Admin SDK
initializeApp();
const db = admin.firestore();

// Initialize Stripe SDK
// Make sure to set the stripe.secret_key in your Firebase environment config
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});


/**
 * 1. createStripeConnectedAccount
 * Creates a Stripe Express Connected Account for a seller.
 */
export const createStripeConnectedAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const {uid} = request.auth;

  try {
    const account = await stripe.accounts.create({
      type: "express",
      email: request.auth.token.email,
      capabilities: {
        card_payments: {requested: true},
        transfers: {requested: true},
      },
    });

    await db.collection("users").doc(uid).update({
      stripeAccountId: account.id,
      stripeOnboardingComplete: false,
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.APP_URL}/profile/stripe-onboarding`,
      return_url: `${process.env.APP_URL}/profile`,
      type: "account_onboarding",
    });

    return {url: accountLink.url};
  } catch (error) {
    logger.error("Error creating Stripe account:", error);
    throw new HttpsError("internal", "Could not create Stripe account.");
  }
});


/**
 * 2. createPaymentIntent
 * Creates a Payment Intent for a purchase with escrow.
 */
export const createPaymentIntent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const {items} = request.data;
  const {uid: buyerId} = request.auth;

  if (!items || items.length === 0) {
    throw new HttpsError("invalid-argument", "No items provided.");
  }

  // For now, assume all items are from the same seller for simplicity
  const firstItem = items[0];
  const sellerId = firstItem.sellerId;

  const sellerDoc = await db.collection("users").doc(sellerId).get();
  const sellerData = sellerDoc.data();

  if (!sellerData?.stripeAccountId || !sellerData?.stripeOnboardingComplete) {
    throw new HttpsError("failed-precondition", "The seller is not ready to receive payments.");
  }

  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    const productRef = db.collection("products").doc(item.id);
    const productSnap = await productRef.get();

    if (!productSnap.exists || productSnap.data()?.status !== "active") {
      throw new HttpsError("failed-precondition", `Product ${item.id} is not available for purchase.`);
    }
    totalAmount += productSnap.data()?.price || 0;
    orderItems.push({
      productId: item.id,
      sellerId: item.sellerId,
      title: item.title,
      brand: item.brand,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
    });
  }

  const shippingFee = 500; // 5.00 EUR in cents
  totalAmount = (totalAmount * 100) + shippingFee;

  const commission = Math.round(totalAmount * 0.15);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: "eur",
      capture_method: "manual", // Escrow hold
      application_fee_amount: commission,
      transfer_data: {
        destination: sellerData.stripeAccountId,
      },
    });

    const orderRef = await db.collection("orders").add({
      orderNumber: `MRG-${Date.now()}`,
      buyerId,
      sellerIds: [sellerId],
      items: orderItems,
      totalAmount: totalAmount / 100,
      status: "pending_payment",
      paymentIntentId: paymentIntent.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {clientSecret: paymentIntent.client_secret, orderId: orderRef.id};
  } catch (error) {
    logger.error("Error creating PaymentIntent:", error);
    throw new HttpsError("internal", "Could not create payment intent.");
  }
});


/**
 * 3. handleStripeWebhook
 * Handles incoming webhooks from Stripe to update order statuses.
 */
export const handleStripeWebhook = onRequest({secrets: ["STRIPE_WEBHOOK_SECRET"]}, async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    res.status(400).send("Webhook secret not configured.");
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (err: any) {
    logger.error("Webhook signature verification failed.", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  switch (event.type) {
    case "payment_intent.succeeded":
      logger.info("PaymentIntent succeeded:", paymentIntent.id);
      const ordersQuerySucceeded = await db.collection("orders").where("paymentIntentId", "==", paymentIntent.id).get();
      if (!ordersQuerySucceeded.empty) {
        const orderDoc = ordersQuerySucceeded.docs[0];
        await orderDoc.ref.update({status: "processing"});
        // Add logic to notify seller (FCM/Email)
      }
      break;
    case "payment_intent.payment_failed":
      logger.error("PaymentIntent failed:", paymentIntent.id, paymentIntent.last_payment_error?.message);
      const ordersQueryFailed = await db.collection("orders").where("paymentIntentId", "==", paymentIntent.id).get();
      if (!ordersQueryFailed.empty) {
        const orderDoc = ordersQueryFailed.docs[0];
        await orderDoc.ref.update({status: "payment_failed", error: paymentIntent.last_payment_error?.message});
        // Add logic to notify buyer
      }
      break;
    case "charge.refunded":
      logger.info("Charge refunded for PaymentIntent:", paymentIntent.id);
      const ordersQueryRefunded = await db.collection("orders").where("paymentIntentId", "==", paymentIntent.id).get();
      if (!ordersQueryRefunded.empty) {
        const orderDoc = ordersQueryRefunded.docs[0];
        await orderDoc.ref.update({status: "refunded"});
        // Add logic to notify both parties
      }
      break;
    default:
      logger.warn(`Unhandled event type: ${event.type}`);
  }

  res.status(200).send();
});


/**
 * 4. capturePayment
 * Captures the held payment for an order.
 */
export const capturePayment = onCall(async (request) => {
  // Add admin/system auth check here
  const {orderId} = request.data;
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Missing orderId.");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Order not found.");
  }

  const order = orderSnap.data();
  if (!order?.paymentIntentId) {
    throw new HttpsError("failed-precondition", "Order has no payment intent.");
  }

  try {
    await stripe.paymentIntents.capture(order.paymentIntentId);
    await orderRef.update({status: "completed"});
    logger.info(`Payment captured for order ${orderId}`);
    return {success: true};
  } catch (error) {
    logger.error(`Failed to capture payment for order ${orderId}:`, error);
    throw new HttpsError("internal", "Could not capture payment.");
  }
});


/**
 * 5. processRefund
 * Processes a refund for a given order.
 */
export const processRefund = onCall(async (request) => {
  // Add admin auth check here
  const {orderId, amount} = request.data;
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Missing orderId.");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Order not found.");
  }
  const order = orderSnap.data();
  if (!order?.paymentIntentId) {
    throw new HttpsError("failed-precondition", "Order has no payment intent.");
  }

  try {
    await stripe.refunds.create({
      payment_intent: order.paymentIntentId,
      amount: amount ? amount * 100 : undefined, // amount in cents if provided
    });
    // Webhook will handle order status update
    return {success: true};
  } catch (error) {
    logger.error(`Failed to process refund for order ${orderId}:`, error);
    throw new HttpsError("internal", "Could not process refund.");
  }
});

/**
 * 6. releaseEscrow (Scheduled)
 * Automatically releases payments for delivered orders.
 */
export const releaseEscrow = onSchedule("every 1 hours", async () => {
  const threeDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 72 * 60 * 60 * 1000);
  const query = db.collection("orders")
    .where("status", "==", "delivered")
    .where("deliveredAt", "<=", threeDaysAgo);

  const snapshot = await query.get();
  if (snapshot.empty) {
    logger.info("No orders to process for escrow release.");
    return;
  }

  const promises = snapshot.docs.map(async (doc) => {
    const order = doc.data();
    if (order.paymentIntentId) {
      try {
        await stripe.paymentIntents.capture(order.paymentIntentId);
        await doc.ref.update({status: "completed"});
        logger.info(`Auto-captured payment for order ${doc.id}`);
      } catch (error) {
        logger.error(`Failed to auto-capture payment for order ${doc.id}:`, error);
      }
    }
  });

  await Promise.all(promises);
});
