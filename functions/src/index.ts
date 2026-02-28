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

// Helper per inizializzare Stripe con i segreti iniettati
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) {
    logger.error("STRIPE_SECRET_KEY non configurata. Esegui 'firebase functions:secrets:set STRIPE_SECRET_KEY'");
    throw new HttpsError("failed-precondition", "Il provider di pagamento non è configurato correttamente sul server.");
  }
  return new Stripe(key, {
    apiVersion: "2024-06-20",
  });
};

export const createStripeConnectedAccount = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Devi essere loggato per configurare i pagamenti.");
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
    logger.error("Errore creazione account Stripe:", error);
    throw new HttpsError("internal", error.message || "Impossibile creare l'account Stripe.");
  }
});

export const createPaymentIntent = onCall({secrets: ["STRIPE_SECRET_KEY"], minInstances: 1}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Accesso negato.");
  }
  
  const {items, shippingAddress} = request.data;
  const {uid: buyerId} = request.auth;
  const stripe = getStripe();

  if (!items || items.length === 0) {
    throw new HttpsError("invalid-argument", "Il carrello è vuoto.");
  }

  try {
    const firstItem = items[0];
    const sellerId = firstItem.sellerId;

    if (!sellerId) {
      throw new HttpsError("invalid-argument", "Informazioni venditore mancanti.");
    }

    const sellerDoc = await db.collection("users").doc(sellerId).get();
    const sellerData = sellerDoc.data();

    // Verifica se il venditore è pronto per ricevere pagamenti (Necessario per transfer_data)
    if (!sellerData?.stripeAccountId || sellerData?.stripeOnboardingComplete === false) {
        throw new HttpsError("failed-precondition", "Il venditore non ha ancora configurato il suo account per ricevere pagamenti. Ti suggeriamo di contattarlo via chat.");
    }

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const productRef = db.collection("products").doc(item.id);
      const productSnap = await productRef.get();

      if (!productSnap.exists) {
        throw new HttpsError("not-found", `Prodotto ${item.id} non trovato.`);
      }
      
      const pData = productSnap.data();
      const isAvailable = ["active", "pending_review", "reserved"].includes(pData?.status);
      if (!isAvailable) {
        throw new HttpsError("failed-precondition", `L'articolo "${pData?.title || "selezionato"}" non è più disponibile.`);
      }

      const price = pData?.price || 0;
      totalAmount += price;
      orderItems.push({
        productId: item.id,
        sellerId: pData?.sellerId,
        title: pData?.title,
        brand: pData?.brand,
        image: pData?.images?.[0] || "",
        price: price,
        quantity: 1,
        size: pData?.size || null,
      });
    }

    const shippingFee = 10.90; 
    const totalInCents = Math.round((totalAmount + (shippingFee * items.length)) * 100);
    const commission = Math.round(totalInCents * 0.15); // 15% commissione piattaforma

    // Creazione PaymentIntent con cattura manuale (ESCROW)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: "eur",
      capture_method: "manual", // Fondi bloccati sulla carta
      transfer_data: { 
        destination: sellerData.stripeAccountId,
        amount: totalInCents - commission, // Al venditore va il totale meno la commissione
      },
      metadata: { buyerId, sellerId, orderType: 'marketplace' }
    });

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
    logger.error("Errore creazione PaymentIntent:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Errore durante l'inizializzazione del pagamento.");
  }
});

export const createOrder = onCall({minInstances: 1}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Accesso negato.");
  }
  const {items, shippingAddress} = request.data;
  const {uid: buyerId} = request.auth;

  try {
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const productRef = db.collection("products").doc(item.id);
      const productSnap = await productRef.get();
      if (!productSnap.exists) continue;
      
      const pData = productSnap.data();
      totalAmount += pData?.price || 0;
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

    const shippingFee = 10.90 * items.length; 
    totalAmount += shippingFee;

    const orderRef = await db.collection("orders").add({
      orderNumber: `MRG-COD-${Date.now()}`,
      buyerId,
      sellerIds: [items[0].sellerId],
      items: orderItems,
      totalAmount: totalAmount,
      status: "processing",
      paymentMethod: "cod",
      paymentStatus: "pending",
      shippingAddress: shippingAddress || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {orderId: orderRef.id};
  } catch (error: any) {
    logger.error("Errore ordine COD:", error);
    throw new HttpsError("internal", "Impossibile completare l'ordine.");
  }
});

export const handleStripeWebhook = onRequest({secrets: ["STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY"], minInstances: 1}, async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  if (!signature || !webhookSecret) {
    res.status(400).send("Configurazione webhook mancante.");
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (err: any) {
    logger.error("Firma webhook non valida.", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  switch (event.type) {
    case "payment_intent.succeeded":
      const ordersQuery = await db.collection("orders").where("paymentIntentId", "==", paymentIntent.id).get();
      if (!ordersQuery.empty) {
        await ordersQuery.docs[0].ref.update({status: "processing", paymentStatus: "paid"});
        // Aggiorna lo stato dei prodotti a "sold"
        const orderData = ordersQuery.docs[0].data();
        for (const item of orderData.items) {
            await db.collection("products").doc(item.productId).update({ status: "sold" });
        }
      }
      break;
    case "payment_intent.payment_failed":
      const ordersFailQuery = await db.collection("orders").where("paymentIntentId", "==", paymentIntent.id).get();
      if (!ordersFailQuery.empty) {
        await ordersFailQuery.docs[0].ref.update({status: "payment_failed", error: paymentIntent.last_payment_error?.message});
      }
      break;
  }

  res.status(200).send();
});

export const capturePayment = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  const {orderId} = request.data;
  if (!orderId) throw new HttpsError("invalid-argument", "ID ordine mancante.");
  const stripe = getStripe();

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Ordine non trovato.");

  const order = orderSnap.data();
  if (!order?.paymentIntentId) throw new HttpsError("failed-precondition", "L'ordine non ha un pagamento Stripe associato.");

  try {
    await stripe.paymentIntents.capture(order.paymentIntentId);
    await orderRef.update({status: "completed"});
    return {success: true};
  } catch (error: any) {
    logger.error(`Fallimento cattura pagamento ${orderId}:`, error);
    throw new HttpsError("internal", error.message || "Impossibile incassare il pagamento.");
  }
});

export const processRefund = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  const {orderId, amount} = request.data;
  if (!orderId) throw new HttpsError("invalid-argument", "ID ordine mancante.");
  const stripe = getStripe();

  const orderSnap = await db.collection("orders").doc(orderId).get();
  const order = orderSnap.data();

  try {
    await stripe.refunds.create({
      payment_intent: order?.paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
    });
    await orderSnap.ref.update({status: "refunded"});
    return {success: true};
  } catch (error: any) {
    logger.error(`Errore rimborso ${orderId}:`, error);
    throw new HttpsError("internal", error.message || "Errore durante il rimborso.");
  }
});

export const releaseEscrow = onSchedule({schedule: "every 1 hours", secrets: ["STRIPE_SECRET_KEY"]}, async (event) => {
  const threeDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 72 * 60 * 60 * 1000);
  const stripe = getStripe();
  
  const query = db.collection("orders")
    .where("status", "==", "delivered")
    .where("deliveredAt", "<=", threeDaysAgo);

  const snapshot = await query.get();
  if (snapshot.empty) return;

  const promises = snapshot.docs.map(async (doc) => {
    const order = doc.data();
    if (order.paymentIntentId) {
      try {
        await stripe.paymentIntents.capture(order.paymentIntentId);
        await doc.ref.update({status: "completed"});
      } catch (error) {
        logger.error(`Auto-capture fallito per ${doc.id}:`, error);
      }
    }
  });

  await Promise.all(promises);
});

// IA Moderation
const vertexAI = new VertexAI({
  project: process.env.GCLOUD_PROJECT,
  location: "us-central1",
});

const generativeModel = vertexAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

export const moderateProductImage = onDocumentWritten("products/{productId}", async (event) => {
  const snapshotAfter = event.data?.after;
  const productData = snapshotAfter?.data();
  if (!productData || !snapshotAfter || productData.status !== "pending_review") return;

  const images = productData.images as string[]; 
  if (!images || images.length === 0) return;

  try {
    const bucket = getStorage().bucket();
    const imageParts = await Promise.all(
        images.map(async (imageUrl) => {
            try {
                const url = new URL(imageUrl);
                const filePath = decodeURIComponent(url.pathname.split("/o/")[1].split("?")[0]);
                const file = bucket.file(filePath);
                const [buffer] = await file.download();
                return { inlineData: { data: buffer.toString("base64"), mimeType: (await file.getMetadata())[0].contentType || "image/webp" } };
            } catch (e) { return null; }
        })
    );

    const validImageParts = imageParts.filter((p) => p !== null);
    if (validImageParts.length > 0) {
        const streamingResp = await generativeModel.generateContentStream({ contents: [{role: "user", parts: validImageParts as any[]}] });
        const response = await streamingResp.response;
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        
        let overallResult = "approved";
        const reasons: string[] = [];

        if (safetyRatings) {
            for (const rating of safetyRatings) {
                if (rating.probability === "HIGH" || rating.probability === "MEDIUM") {
                    overallResult = "needs_review";
                    reasons.push(`Flagged for ${rating.category}.`);
                    if (rating.probability === "HIGH") overallResult = "rejected";
                }
            }
        }

        const updateData: any = { moderation: { status: overallResult, reasons, checkedAt: admin.firestore.FieldValue.serverTimestamp() } };
        if (overallResult === "rejected") updateData.status = "rejected";
        else if (overallResult === "approved") updateData.status = "active";

        await snapshotAfter.ref.update(updateData);
    }
  } catch (error) {
      logger.error(`Moderation error:`, error);
  }
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
  const availableCouriersSnap = await db.collection("courier_profiles").where("isAvailable", "==", true).limit(1).get();
  if (availableCouriersSnap.empty) throw new HttpsError("not-found", "No couriers available.");
  const courierId = availableCouriersSnap.docs[0].id;
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
  const deliveryRef = db.doc(`deliveries/${deliveryId}`);
  const deliverySnap = await deliveryRef.get();
  await deliveryRef.update({ status: "delivered", deliveredAt: admin.firestore.FieldValue.serverTimestamp(), proofOfDelivery: proofOfDeliveryUrl });
  if (deliverySnap.data()?.orderId) {
      await db.doc(`orders/${deliverySnap.data()?.orderId}`).update({ status: "delivered", deliveredAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  return {success: true};
});

export const exportUserData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const userId = request.auth.uid;
  const userDoc = await db.collection("users").doc(userId).get();
  const bucket = getStorage().bucket();
  const file = bucket.file(`user-exports/${userId}/${Date.now()}.json`);
  await file.save(JSON.stringify(userDoc.data(), null, 2), { contentType: "application/json" });
  const [signedUrl] = await file.getSignedUrl({ action: "read", expires: Date.now() + 15 * 60 * 1000 });
  return {downloadUrl: signedUrl};
});

export const deleteAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
  const userId = request.auth.uid;
  await admin.auth().deleteUser(userId);
  await db.collection("users").doc(userId).delete();
  return {success: true};
});