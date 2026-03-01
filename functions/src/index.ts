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
    throw new HttpsError("failed-precondition", "STRIPE_SECRET_KEY non configurata sul server.");
  }
  return new Stripe(key, {
    apiVersion: "2024-06-20",
  });
};

export const createStripeConnectedAccount = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Devi essere loggato.");
  }
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
    logger.error("Errore Stripe Account:", error);
    throw new HttpsError("internal", error.message);
  }
});

export const createPaymentIntent = onCall({secrets: ["STRIPE_SECRET_KEY"], minInstances: 1}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Accesso negato.");
  
  const {items, shippingAddress} = request.data;
  if (!items || items.length === 0) throw new HttpsError("invalid-argument", "Carrello vuoto.");

  const stripe = getStripe();
  const buyerId = request.auth.uid;

  try {
    // 1. Validazione Seller
    const sellerId = items[0].sellerId;
    if (!sellerId) throw new HttpsError("invalid-argument", "Venditore non identificato.");

    const sellerSnap = await db.collection("users").doc(sellerId).get();
    const sellerData = sellerSnap.data();

    if (!sellerData?.stripeAccountId) {
      throw new HttpsError("failed-precondition", "Il venditore non ha configurato Stripe per ricevere pagamenti.");
    }

    // 2. Validazione Prodotti e Calcolo Totale
    let itemsSubtotal = 0;
    const orderItems = [];
    const shippingFeePerItem = 10.90;

    for (const item of items) {
      const pSnap = await db.collection("products").doc(item.id).get();
      if (!pSnap.exists) throw new HttpsError("not-found", `Prodotto ${item.id} non trovato.`);
      
      const pData = pSnap.data();
      if (!["active", "pending_review", "reserved"].includes(pData?.status)) {
        throw new HttpsError("failed-precondition", `L'articolo "${pData?.title}" non è più disponibile.`);
      }

      itemsSubtotal += (pData?.price || 0);
      orderItems.push({
        productId: item.id,
        sellerId: pData?.sellerId,
        title: pData?.title,
        brand: pData?.brand,
        image: pData?.images?.[0] || "",
        price: pData?.price || 0,
        quantity: 1,
        size: pData?.size || null,
      });
    }

    const totalInCents = Math.round((itemsSubtotal + (shippingFeePerItem * items.length)) * 100);
    const commissionCents = Math.round(totalInCents * 0.15); // 15% commission

    // 3. Creazione PaymentIntent su Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: "eur",
      capture_method: "manual", // ESCROW
      transfer_data: { 
        destination: sellerData.stripeAccountId,
        amount: totalInCents - commissionCents, 
      },
      metadata: { buyerId, sellerId, orderType: 'marketplace' }
    });

    // 4. Creazione ordine in Firestore
    const orderRef = await db.collection("orders").add({
      orderNumber: `MRG-${Date.now()}`,
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
    throw new HttpsError("internal", error.message || "Errore sconosciuto nel checkout.");
  }
});

export const createOrder = onCall({minInstances: 1}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Accesso negato.");
  const {items, shippingAddress} = request.data;
  const buyerId = request.auth.uid;

  try {
    let total = 0;
    const orderItems = [];
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
        quantity: 1,
        size: pData?.size || null,
      });
    }
    total += (10.90 * items.length);

    const orderRef = await db.collection("orders").add({
      orderNumber: `MRG-COD-${Date.now()}`,
      buyerId,
      sellerIds: [items[0].sellerId],
      items: orderItems,
      totalAmount: total,
      status: "processing",
      paymentMethod: "cod",
      paymentStatus: "pending",
      shippingAddress: shippingAddress || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {orderId: orderRef.id};
  } catch (error: any) {
    throw new HttpsError("internal", "Impossibile completare ordine COD.");
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
          status: "processing",
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

export const capturePayment = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  const {orderId} = request.data;
  const stripe = getStripe();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Ordine non trovato.");
  const order = snap.data();
  try {
    await stripe.paymentIntents.capture(order?.paymentIntentId);
    await orderRef.update({status: "completed"});
    return {success: true};
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

export const releaseEscrow = onSchedule({schedule: "every 1 hours", secrets: ["STRIPE_SECRET_KEY"]}, async (event) => {
  const threeDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 72 * 60 * 60 * 1000);
  const stripe = getStripe();
  const snapshot = await db.collection("orders")
    .where("status", "==", "delivered")
    .where("deliveredAt", "<=", threeDaysAgo).get();

  for (const doc of snapshot.docs) {
    const order = doc.data();
    if (order.paymentIntentId) {
      try {
        await stripe.paymentIntents.capture(order.paymentIntentId);
        await doc.ref.update({status: "completed"});
      } catch (e) { logger.error("Auto-capture fallito", e); }
    }
  }
});

// AI Moderation
const vertexAI = new VertexAI({ project: process.env.GCLOUD_PROJECT, location: "us-central1" });
const generativeModel = vertexAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const moderateProductImage = onDocumentWritten("products/{productId}", async (event) => {
  const after = event.data?.after;
  const data = after?.data();
  if (!data || data.status !== "pending_review") return;
  const images = data.images as string[];
  if (!images?.length) return;

  try {
    const bucket = getStorage().bucket();
    const parts = await Promise.all(images.map(async (url) => {
      try {
        const path = decodeURIComponent(new URL(url).pathname.split("/o/")[1].split("?")[0]);
        const [buffer] = await bucket.file(path).download();
        return { inlineData: { data: buffer.toString("base64"), mimeType: "image/webp" } };
      } catch { return null; }
    }));

    const validParts = parts.filter(p => p !== null);
    if (validParts.length) {
      const resp = await generativeModel.generateContent({ contents: [{role: "user", parts: validParts as any[]}] });
      const safety = resp.response.candidates?.[0]?.safetyRatings;
      let status = "approved";
      if (safety?.some(r => r.probability === "HIGH")) status = "rejected";
      else if (safety?.some(r => r.probability === "MEDIUM")) status = "needs_review";

      await after!.ref.update({
        moderation: { status, checkedAt: admin.firestore.FieldValue.serverTimestamp() },
        status: status === "rejected" ? "rejected" : (status === "approved" ? "active" : "pending_review")
      });
    }
  } catch (e) { logger.error("Moderation error", e); }
});

export const calculateDeliveryFee = onCall(async (request) => {
  const {distanceKm, isRush} = request.data;
  let fee = 3.00 + (Number(distanceKm || 0) * 0.50);
  if (isRush) fee *= 1.5;
  return {fee: parseFloat(fee.toFixed(2))};
});

export const assignCourier = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const {deliveryId} = request.data;
  const couriers = await db.collection("courier_profiles").where("isAvailable", "==", true).limit(1).get();
  if (couriers.empty) throw new HttpsError("not-found", "No couriers available.");
  const courierId = couriers.docs[0].id;
  await db.doc(`deliveries/${deliveryId}`).update({ courierId, status: "assigned" });
  return {success: true, courierId};
});

export const updateCourierLocation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const {deliveryId, latitude, longitude} = request.data;
  await db.doc(`deliveries/${deliveryId}`).update({ currentLocation: new admin.firestore.GeoPoint(latitude, longitude) });
  return {success: true};
});

export const completeDelivery = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const {deliveryId, proofOfDeliveryUrl} = request.data;
  const ref = db.doc(`deliveries/${deliveryId}`);
  const snap = await ref.get();
  await ref.update({ status: "delivered", deliveredAt: admin.firestore.FieldValue.serverTimestamp(), proofOfDelivery: proofOfDeliveryUrl });
  if (snap.data()?.orderId) {
    await db.doc(`orders/${snap.data()?.orderId}`).update({ status: "delivered", deliveredAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  return {success: true};
});

export const exportUserData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const uid = request.auth.uid;
  const user = await db.collection("users").doc(uid).get();
  const bucket = getStorage().bucket();
  const file = bucket.file(`user-exports/${uid}/${Date.now()}.json`);
  await file.save(JSON.stringify(user.data(), null, 2));
  const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 900000 });
  return {downloadUrl: url};
});

export const deleteAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const uid = request.auth.uid;
  await admin.auth().deleteUser(uid);
  await db.collection("users").doc(uid).delete();
  return {success: true};
});