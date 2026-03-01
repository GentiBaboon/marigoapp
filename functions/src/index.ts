import * as admin from "firebase-admin";
import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
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
 * Creates a Stripe Express Connected Account for a seller.
 */
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
        isSeller: true,
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.APP_URL || "https://marigoapp.com"}/profile/stripe-onboarding`,
      return_url: `${process.env.APP_URL || "https://marigoapp.com"}/profile`,
      type: "account_onboarding",
    });

    return {url: accountLink.url};
  } catch (error: any) {
    logger.error("Stripe Account Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Creates a PaymentIntent with manual capture for Escrow.
 */
export const createPaymentIntent = onCall({secrets: ["STRIPE_SECRET_KEY"], minInstances: 1}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  
  const {items, shippingAddress} = request.data;
  if (!items || items.length === 0) throw new HttpsError("invalid-argument", "Empty cart.");

  const stripe = getStripe();
  const buyerId = request.auth.uid;

  try {
    // 1. Get Seller info (assuming single seller per order for MVP)
    const sellerId = items[0].sellerId;
    const sellerSnap = await db.collection("users").doc(sellerId).get();
    const sellerData = sellerSnap.data();

    // 2. Validate Products and Calculate Total
    let itemsSubtotal = 0;
    const orderItems = [];
    const shippingFee = 5.00; // Flat fee per item for MVP

    for (const item of items) {
      const pSnap = await db.collection("products").doc(item.id).get();
      if (!pSnap.exists || pSnap.data()?.status !== 'active') {
        throw new HttpsError("failed-precondition", `Item ${item.title} is no longer available.`);
      }
      
      const pData = pSnap.data();
      itemsSubtotal += pData?.price;
      orderItems.push({
        productId: item.id,
        sellerId: pData?.sellerId,
        title: pData?.title,
        brand: pData?.brandId || pData?.brand,
        image: pData?.images?.[0]?.url || "",
        price: pData?.price,
        quantity: 1,
      });
    }

    const totalAmount = itemsSubtotal + (shippingFee * items.length);
    const totalInCents = Math.round(totalAmount * 100);
    const commissionCents = Math.round(totalInCents * 0.15); // 15% commission

    // 3. Create Stripe PaymentIntent
    // Funds are held (escrow) by using capture_method: manual
    const paymentParams: Stripe.PaymentIntentCreateParams = {
      amount: totalInCents,
      currency: "eur",
      payment_method_types: ["card"],
      capture_method: "manual",
      metadata: { buyerId, sellerId, orderType: 'marketplace' }
    };

    // If seller has Stripe Account, set up the transfer
    if (sellerData?.stripeAccountId) {
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
      totalAmount: totalAmount,
      status: "pending_payment",
      paymentMethod: "card",
      paymentIntentId: paymentIntent.id,
      shippingAddress: shippingAddress,
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
 * Stripe Webhook Handler
 */
export const handleStripeWebhook = onRequest({secrets: ["STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY"]}, async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature as string, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orders = await db.collection("orders").where("paymentIntentId", "==", pi.id).get();
    
    if (!orders.empty) {
      const orderDoc = orders.docs[0];
      await orderDoc.ref.update({ status: "paid" });

      // Mark products as sold
      const orderData = orderDoc.data();
      for (const item of orderData.items) {
        await db.collection("products").doc(item.productId).update({ status: "sold" });
      }
    }
  }

  res.status(200).send();
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
                logger.info(`Escrow released for order ${doc.id}`);
            } catch (e) {
                logger.error(`Failed to release escrow for order ${doc.id}`, e);
            }
        }
    }
});
