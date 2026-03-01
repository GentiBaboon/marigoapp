import * as admin from "firebase-admin";
import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {VertexAI} from "@google-cloud/vertexai";
import {getStorage} from "firebase-admin/storage";

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

export const createStripeConnectedAccount = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  const {uid} = request.auth;
  const stripe = getStripe();

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();
    let accountId = userData?.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: request.auth.token.email,
        capabilities: {
          card_payments: {requested: true},
          transfers: {requested: true},
        },
        metadata: { userId: uid }
      });
      accountId = account.id;
      await db.collection("users").doc(uid).update({
        stripeAccountId: accountId,
        stripeOnboardingComplete: false,
        isSeller: true,
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.APP_URL || "https://www.marigo.app"}/profile/stripe-onboarding`,
      return_url: `${process.env.APP_URL || "https://www.marigo.app"}/profile`,
      type: "account_onboarding",
    });

    return {url: accountLink.url};
  } catch (error: any) {
    logger.error("Stripe Account Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Creates a Stripe PaymentIntent for the checkout flow.
 * Implements Escrow by using manual capture and Connect transfers.
 */
export const createPaymentIntent = onCall({secrets: ["STRIPE_SECRET_KEY"], minInstances: 1}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  
  const {items, shippingAddress} = request.data;
  if (!items || items.length === 0) throw new HttpsError("invalid-argument", "Empty cart.");

  const stripe = getStripe();
  const buyerId = request.auth.uid;

  try {
    // 1. Get Seller info (assuming single seller for MVP simplified)
    const sellerId = items[0].sellerId;
    if (!sellerId) throw new HttpsError("invalid-argument", "Seller not found.");

    const sellerSnap = await db.collection("users").doc(sellerId).get();
    const sellerData = sellerSnap.data();

    // 2. Validate Products and Calculate Total
    let itemsSubtotal = 0;
    const orderItems = [];
    const shippingFeePerItem = 10.90;

    for (const item of items) {
      const pSnap = await db.collection("products").doc(item.id).get();
      if (!pSnap.exists) throw new HttpsError("not-found", `Product ${item.id} not found.`);
      
      const pData = pSnap.data();
      if (pData?.status === 'sold') {
        throw new HttpsError("failed-precondition", `The item "${pData?.title}" is no longer available.`);
      }

      itemsSubtotal += (pData?.price || 0);
      orderItems.push({
        productId: item.id,
        sellerId: pData?.sellerId,
        title: pData?.title,
        brand: pData?.brand,
        image: pData?.images?.[0] || "",
        price: pData?.price || 0,
        quantity: item.quantity,
        size: item.size || null,
      });
    }

    const totalInCents = Math.round((itemsSubtotal + (shippingFeePerItem * items.length)) * 100);
    const commissionCents = Math.round(totalInCents * 0.15); // 15% commission

    // 3. Create Stripe PaymentIntent
    // If seller has Stripe Account, we use Destination Charges for Escrow
    let paymentParams: Stripe.PaymentIntentCreateParams = {
      amount: totalInCents,
      currency: "eur",
      payment_method_types: ["card"],
      capture_method: "manual", // ESCROW: We auth now, capture later
      metadata: { buyerId, sellerId, orderType: 'marketplace' }
    };

    if (sellerData?.stripeAccountId && sellerData.stripeOnboardingComplete) {
        paymentParams.transfer_data = {
            destination: sellerData.stripeAccountId,
            amount: totalInCents - commissionCents,
        };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentParams);

    // 4. Create Order in Firestore
    const orderRef = await db.collection("orders").add({
      orderNumber: `MG-${Date.now()}`,
      buyerId,
      sellerIds: [sellerId],
      items: orderItems,
      totalAmount: totalInCents / 100,
      status: "pending_payment",
      paymentMethod: "card",
      paymentIntentId: paymentIntent.id,
      shippingAddress: shippingAddress || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {clientSecret: paymentIntent.client_secret, orderId: orderRef.id};
  } catch (error: any) {
    logger.error("createPaymentIntent Error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Unknown checkout error.");
  }
});

/**
 * Finalises a Cash on Delivery order.
 */
export const createOrder = onCall({minInstances: 1}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  const {items, shippingAddress} = request.data;
  const buyerId = request.auth.uid;

  try {
    let total = 0;
    const orderItems = [];
    const shippingFeePerItem = 10.90;

    for (const item of items) {
      const pSnap = await db.collection("products").doc(item.id).get();
      if (!pSnap.exists) continue;
      const pData = pSnap.data();
      total += (pData?.price || 0);
      orderItems.push({
        productId: item.id,
        sellerId: pData?.sellerId,
        title: pData?.title,
        brand: pData?.brand,
        image: pData?.images?.[0] || "",
        price: pData?.price || 0,
        quantity: item.quantity,
        size: item.size || null,
      });
    }
    total += (shippingFeePerItem * items.length);

    const orderRef = await db.collection("orders").add({
      orderNumber: `MG-COD-${Date.now()}`,
      buyerId,
      sellerIds: [items[0].sellerId],
      items: orderItems,
      totalAmount: total,
      status: "processing", // Ready for pickup
      paymentMethod: "cod",
      paymentStatus: "pending",
      shippingAddress: shippingAddress || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark products as reserved/sold
    for (const item of orderItems) {
        await db.collection("products").doc(item.productId).update({ status: 'sold' });
    }

    return {orderId: orderRef.id};
  } catch (error: any) {
    logger.error("createOrder COD Error:", error);
    throw new HttpsError("internal", "Could not complete COD order.");
  }
});

export const handleStripeWebhook = onRequest({secrets: ["STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY"], minInstances: 1}, async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature as string, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.amount_capturable_updated") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orders = await db.collection("orders").where("paymentIntentId", "==", pi.id).get();
    if (!orders.empty) {
      const orderDoc = orders.docs[0];
      const orderData = orderDoc.data();

      if (orderData.status === "pending_payment") {
        await orderDoc.ref.update({
          status: "paid",
          paymentStatus: pi.status === "succeeded" ? "paid" : "authorized"
        });

        // Mark products as sold
        for (const item of orderData.items) {
          await db.collection("products").doc(item.productId).update({ status: "sold" });
        }
      }
    }
  }
  res.status(200).send();
});

// AI Moderation & Cloud Triggers remain same...
// [rest of functions code]
