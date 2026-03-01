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
 * Helper to send notifications (In-app, FCM, and Logged Email)
 */
async function sendOrderNotification(userId: string, title: string, message: string, orderId: string, type: string) {
  try {
    // 1. In-app notification
    await db.collection("notifications").add({
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      data: {
        orderId,
        link: `/profile/orders/${orderId}`,
      }
    });

    // 2. Fetch User Data for FCM and Email
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();

    // 3. FCM Push Notification
    if (userData?.fcmToken) {
      await admin.messaging().send({
        token: userData.fcmToken,
        notification: { title, body: message },
        data: { orderId, type },
      });
    }

    // 4. Log Email (Placeholder for real SMTP/SendGrid integration)
    logger.info(`[EMAIL SENT] To: ${userData?.email || "Unknown"} | Subject: ${title} | Body: ${message}`);

  } catch (error) {
    logger.error("Notification Error:", error);
  }
}

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
 * Gets the Stripe balance for a connected seller account.
 */
export const getSellerBalance = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  const stripe = getStripe();
  const uid = request.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const accountId = userDoc.data()?.stripeAccountId;

    if (!accountId) {
      return { available: 0, pending: 0, currency: "eur" };
    }

    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId,
    });

    const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
    const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

    return { available, pending, currency: balance.available[0]?.currency || "eur" };
  } catch (error: any) {
    logger.error("getSellerBalance Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Requests a manual payout for a connected account.
 */
export const requestPayout = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  const stripe = getStripe();
  const uid = request.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const accountId = userDoc.data()?.stripeAccountId;

    if (!accountId) throw new HttpsError("failed-precondition", "Stripe account not configured.");

    const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
    const availableAmount = balance.available.find(b => b.currency === "eur")?.amount || 0;

    if (availableAmount <= 0) {
      throw new HttpsError("failed-precondition", "No funds available for payout.");
    }

    // Manual payout with idempotency key
    const payout = await stripe.payouts.create({
      amount: availableAmount,
      currency: "eur",
    }, {
      stripeAccount: accountId,
      idempotencyKey: `payout_${uid}_${Date.now()}`
    });

    return { success: true, payoutId: payout.id };
  } catch (error: any) {
    logger.error("requestPayout Error:", error);
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
    const sellerId = items[0].sellerId;
    const sellerSnap = await db.collection("users").doc(sellerId).get();
    const sellerData = sellerSnap.data();

    let itemsSubtotal = 0;
    const orderItems = [];
    const shippingFee = 5.00;

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
    const commissionCents = Math.round(totalInCents * 0.15);

    const paymentParams: Stripe.PaymentIntentCreateParams = {
      amount: totalInCents,
      currency: "eur",
      payment_method_types: ["card"],
      capture_method: "manual",
      metadata: { buyerId, sellerId, orderType: 'marketplace' }
    };

    if (sellerData?.stripeAccountId) {
        paymentParams.transfer_data = {
            destination: sellerData.stripeAccountId,
            amount: totalInCents - commissionCents,
        };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentParams);

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
 * Order Automation Trigger
 * Handles notifications based on order status changes
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

  switch (newStatus) {
    case "paid":
      await sendOrderNotification(
        sellerId,
        "New Order Received!",
        `Congratulations! Your item has been sold. Order #${orderNumber} is ready for shipping.`,
        orderId,
        "item_sold"
      );
      break;

    case "shipped":
      await sendOrderNotification(
        buyerId,
        "Your order is on the way!",
        `Good news! Order #${orderNumber} has been shipped. Track it in your profile.`,
        orderId,
        "order_update"
      );
      break;

    case "delivered":
      await sendOrderNotification(
        buyerId,
        "Order Delivered",
        `Order #${orderNumber} has been delivered. Please confirm receipt and leave a review.`,
        orderId,
        "order_update"
      );
      break;

    case "completed":
      await sendOrderNotification(
        sellerId,
        "Payment Released",
        `Funds for Order #${orderNumber} have been released to your account.`,
        orderId,
        "payment_received"
      );
      break;
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
    event = stripe.webhooks.constructEvent((req as any).rawBody, signature as string, process.env.STRIPE_WEBHOOK_SECRET!);
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
