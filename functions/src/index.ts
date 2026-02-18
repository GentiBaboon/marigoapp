import * as admin from "firebase-admin";
import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {VertexAI} from "@google-cloud/vertexai";
import {getStorage} from "firebase-admin/storage";

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
export const createPaymentIntent = onCall({minInstances: 1}, async (request) => {
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
export const handleStripeWebhook = onRequest({secrets: ["STRIPE_WEBHOOK_SECRET"], minInstances: 1}, async (req, res) => {
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
 * [NEW] getMyOrders
 * Fetches all orders where the calling user is the buyer.
 */
export const getMyOrders = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const {uid: buyerId} = request.auth;

  try {
    const ordersQuery = db.collection("orders").where("buyerId", "==", buyerId).orderBy("createdAt", "desc");
    const snapshot = await ordersQuery.get();
    const orders = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    return {orders};
  } catch (error) {
    logger.error(`Error fetching orders for buyer ${buyerId}:`, error);
    throw new HttpsError("internal", "Could not fetch orders.");
  }
});

/**
 * [NEW] getMySales
 * Fetches all sales where the calling user is a seller.
 */
export const getMySales = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const {uid: sellerId} = request.auth;

  try {
    const salesQuery = db.collection("orders").where("sellerIds", "array-contains", sellerId).orderBy("createdAt", "desc");
    const snapshot = await salesQuery.get();
    const sales = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    return {sales};
  } catch (error) {
    logger.error(`Error fetching sales for seller ${sellerId}:`, error);
    throw new HttpsError("internal", "Could not fetch sales.");
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


// =================================================================
// Delivery & Courier Functions
// =================================================================

/**
 * [NEW] calculateDeliveryFee
 * Calculates a delivery fee based on distance.
 * NOTE: This is a placeholder. A real implementation would use the
 * Google Maps Distance Matrix API and require an API key.
 */
export const calculateDeliveryFee = onCall(async (request) => {
  const {distanceKm, isRush} = request.data; // distance in kilometers
  if (typeof distanceKm !== "number") {
    throw new HttpsError("invalid-argument", "Distance must be a number.");
  }

  const BASE_FEE = 3.00; // EUR
  const PER_KM_FEE = 0.50; // EUR
  const RUSH_MULTIPLIER = 1.5;

  let fee = BASE_FEE + (distanceKm * PER_KM_FEE);
  if (isRush) {
    fee *= RUSH_MULTIPLIER;
  }

  return {fee: parseFloat(fee.toFixed(2))};
});

/**
 * [NEW] assignCourier
 * Finds an available courier and assigns them to a delivery.
 * NOTE: This is a simplified version. A real implementation would use
 * geospatial queries (e.g., with GeoFire) to find the *nearest* courier.
 */
export const assignCourier = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be an admin.");
  }
  // TODO: Add admin role check
  const {deliveryId} = request.data;
  if (!deliveryId) {
    throw new HttpsError("invalid-argument", "deliveryId is required.");
  }

  try {
    const availableCouriersSnap = await db.collection("courier_profiles")
      .where("isAvailable", "==", true)
      .limit(1) // Get the first available courier
      .get();

    if (availableCouriersSnap.empty) {
      throw new HttpsError("not-found", "No available couriers found.");
    }

    const courier = availableCouriersSnap.docs[0];
    const courierId = courier.id;

    await db.doc(`deliveries/${deliveryId}`).update({
      courierId: courierId,
      status: "assigned",
    });

    // TODO: Add notification logic to inform the courier.

    logger.info(`Assigned courier ${courierId} to delivery ${deliveryId}`);
    return {success: true, courierId};
  } catch (error) {
    logger.error("Error assigning courier:", error);
    throw new HttpsError("internal", "Could not assign courier.");
  }
});


/**
 * [NEW] updateCourierLocation
 * Updates the courier's real-time location on a delivery document.
 */
export const updateCourierLocation = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be a courier.");
  }
  const {deliveryId, latitude, longitude} = request.data;
  const courierId = request.auth.uid;

  if (!deliveryId || typeof latitude !== "number" || typeof longitude !== "number") {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  const deliveryRef = db.doc(`deliveries/${deliveryId}`);
  const deliverySnap = await deliveryRef.get();

  if (!deliverySnap.exists || deliverySnap.data()?.courierId !== courierId) {
    throw new HttpsError("permission-denied", "You are not assigned to this delivery.");
  }

  try {
    await deliveryRef.update({
      currentLocation: new admin.firestore.GeoPoint(latitude, longitude),
    });
    return {success: true};
  } catch (error) {
    logger.error("Error updating location:", error);
    throw new HttpsError("internal", "Could not update location.");
  }
});

/**
 * [NEW] completeDelivery
 * Finalizes a delivery, saves proof, and updates status.
 */
export const completeDelivery = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be a courier.");
  }

  const {deliveryId, proofOfDeliveryUrl, notes, buyerSignatureUrl} = request.data;
  const courierId = request.auth.uid;

  if (!deliveryId || !proofOfDeliveryUrl) {
    throw new HttpsError("invalid-argument", "Missing deliveryId or proofOfDeliveryUrl.");
  }

  const deliveryRef = db.doc(`deliveries/${deliveryId}`);
  const deliverySnap = await deliveryRef.get();

  if (!deliverySnap.exists || deliverySnap.data()?.courierId !== courierId) {
    throw new HttpsError("permission-denied", "You are not assigned to this delivery.");
  }

  try {
    await deliveryRef.update({
      status: "delivered",
      deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
      proofOfDelivery: proofOfDeliveryUrl,
      notes: notes || null,
      buyerSignature: buyerSignatureUrl || null,
    });

    // Also update the main order status
    const orderId = deliverySnap.data()?.orderId;
    if (orderId) {
        await db.doc(`orders/${orderId}`).update({
            status: "delivered",
            deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    logger.info(`Delivery ${deliveryId} completed by courier ${courierId}.`);
    return {success: true};
  } catch (error) {
    logger.error("Error completing delivery:", error);
    throw new HttpsError("internal", "Could not complete delivery.");
  }
});

/**
 * [NEW] getExchangeRates (Scheduled)
 * Fetches the latest currency exchange rates and saves them to Firestore.
 * This should be scheduled to run daily.
 */
export const getExchangeRates = onSchedule("every 24 hours", async (context) => {
    // IMPORTANT: Add your ExchangeRate-API key to your Firebase environment variables.
    // You can get a free key from https://www.exchangerate-api.com/
    const apiKey = process.env.EXCHANGERATE_API_KEY;
    if (!apiKey) {
        logger.error("ExchangeRate-API key is not set in environment variables. Skipping currency update.");
        return null;
    }
    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/EUR`;

    try {
        const response = await fetch(url);
        const data: any = await response.json();

        if (data.result === "success") {
            const ratesToStore = {
                EUR: data.conversion_rates.EUR,
                USD: data.conversion_rates.USD,
                ALL: data.conversion_rates.ALL,
            };

            await db.collection("config").doc("exchangeRates").set({
                base: "EUR",
                rates: ratesToStore,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            });

            logger.info("Successfully updated currency exchange rates.", ratesToStore);
        } else {
            logger.error("Failed to fetch exchange rates from API:", data["error-type"]);
        }
    } catch (error) {
        logger.error("Error fetching or saving exchange rates:", error);
    }
    return null;
});

// =================================================================
// AI Functions
// =================================================================

// Initialize VertexAI
const vertexAI = new VertexAI({
  project: process.env.GCLOUD_PROJECT,
  location: "us-central1",
});

const generativeModel = vertexAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

export const moderateProductImage = onDocumentCreated("products/{productId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.info("No data associated with the event");
    return;
  }
  const productData = snapshot.data();
  const images = productData.images as string[]; // Array of data URIs
  const finalUpdateData: any = {};

  if (!images || images.length === 0) {
    logger.info(`Product ${snapshot.id} has no images to moderate.`);
    await snapshot.ref.update({
      status: "active",
      moderation: { status: "approved", checkedAt: admin.firestore.FieldValue.serverTimestamp() },
    });
    return;
  }

  try {
    let overallModerationResult = "approved";
    const moderationReasons: string[] = [];

    const imageParts = images.map((imageString) => {
      const base64Data = imageString.split(",")[1];
      if (!base64Data) return null;

      return {
        inlineData: {
          data: base64Data,
          mimeType: imageString.substring(imageString.indexOf(":") + 1, imageString.indexOf(";")),
        },
      };
    }).filter((p) => p !== null);

    if (imageParts.length > 0) {
        const request = {
            contents: [{role: "user", parts: imageParts as any[]}],
        };

        const streamingResp = await generativeModel.generateContentStream(request);
        const response = await streamingResp.response;

        const safetyRatings = response.candidates?.[0]?.safetyRatings;

        if (safetyRatings) {
            for (const rating of safetyRatings) {
            if (rating.probability === "HIGH" || rating.probability === "MEDIUM") {
                if (overallModerationResult !== "rejected") {
                overallModerationResult = "needs_review";
                }
                const reason = `Image flagged for ${rating.category} with probability ${rating.probability}.`;
                if (!moderationReasons.includes(reason)) {
                moderationReasons.push(reason);
                }
                if (rating.probability === "HIGH" && (rating.category === "HARM_CATEGORY_DANGEROUS_CONTENT" || rating.category === "HARM_CATEGORY_SEXUALLY_EXPLICIT")) {
                overallModerationResult = "rejected";
                }
            }
            }
        }
    }

    // --- Authenticity Check Logic ---
    if (productData.price > 200) {
        try {
            const authImageParts = images.map((imageString) => ({
                inlineData: {
                  data: imageString.split(",")[1],
                  mimeType: imageString.substring(imageString.indexOf(":") + 1, imageString.indexOf(";")),
                },
            }));
            const authenticityPrompt = `You are a highly-trained authenticator for luxury fashion items. Your task is to perform a pre-check for authenticity based on user-provided images and details. Do not make a definitive "authentic" or "fake" judgment. Instead, provide a confidence level (high, medium, or low) and the reasons for it in a JSON format: {"confidence": "high" | "medium" | "low", "findings": ["finding 1", "finding 2"]}. Analyze the following details and images, paying close attention to: Logo, Stitching, Hardware, Material, and Serial Number. Product Details: Title: ${productData.title}, Brand: ${productData.brand}, Description: ${productData.description}.`;
            const authRequest = {
                contents: [{ role: "user", parts: [...authImageParts, { text: authenticityPrompt }] }],
                generationConfig: { responseMimeType: "application/json" },
            };
            const authResponse = await generativeModel.generateContent(authRequest);
            const jsonResponseText = authResponse.response.candidates?.[0]?.content?.parts[0]?.text;
            if (jsonResponseText) {
                const authResult = JSON.parse(jsonResponseText);
                finalUpdateData.authenticityCheck = {
                    status: "completed",
                    confidence: authResult.confidence,
                    findings: authResult.findings,
                    checkedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
            } else {
                throw new Error("No JSON response from authenticity check.");
            }
        } catch (authError) {
            logger.error(`Error during authenticity check for product ${snapshot.id}:`, authError);
            finalUpdateData.authenticityCheck = {
                status: "failed",
                confidence: "low",
                findings: ["AI authenticity check could not be completed."],
                checkedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
        }
    }

    // Update Firestore document based on moderation results
    if (overallModerationResult === "rejected") {
        finalUpdateData.status = "rejected";
        finalUpdateData.moderation = {
            status: "rejected",
            reasons: moderationReasons,
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        logger.warn(`Product ${snapshot.id} rejected due to: ${moderationReasons.join(", ")}`);
    } else if (overallModerationResult === "needs_review") {
        finalUpdateData.moderation = {
            status: "needs_review",
            reasons: moderationReasons,
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        logger.info(`Product ${snapshot.id} flagged for admin review.`);
    } else {
        finalUpdateData.status = "active";
        finalUpdateData.moderation = {
            status: "approved",
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        logger.info(`Product ${snapshot.id} approved automatically.`);
    }

    await snapshot.ref.update(finalUpdateData);
  } catch (error) {
      logger.error(`Error during image moderation for product ${snapshot.id}:`, error);
      // Fallback: flag for manual review in case of AI API error
      await snapshot.ref.update({
          moderation: {
              status: "needs_review",
              reasons: ["AI moderation failed. Please review manually."],
              checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
      });
  }
});

// =================================================================
// GDPR & Compliance Functions
// =================================================================

export const exportUserData = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to export your data.");
  }
  const userId = request.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(userId).get();
    const productsQuery = await db.collection("products").where("sellerId", "==", userId).get();
    const ordersQuery = await db.collection("orders").where("buyerId", "==", userId).get();

    const userData = {
      profile: userDoc.data(),
      products: productsQuery.docs.map((doc) => doc.data()),
      orders: ordersQuery.docs.map((doc) => doc.data()),
    };

    const bucket = getStorage().bucket();
    const fileName = `user-exports/${userId}/${Date.now()}.json`;
    const file = bucket.file(fileName);

    await file.save(JSON.stringify(userData, null, 2), {
      contentType: "application/json",
    });

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return {downloadUrl: signedUrl};
  } catch (error) {
    logger.error(`Error exporting data for user ${userId}:`, error);
    throw new HttpsError("internal", "Could not export user data.");
  }
});


export const deleteAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to delete your account.");
  }
  const userId = request.auth.uid;

  try {
    // Delete user from Firebase Authentication
    await admin.auth().deleteUser(userId);

    // Delete user's main profile document from Firestore
    await db.collection("users").doc(userId).delete();

    // IMPORTANT: This does NOT delete subcollections or other user-related data
    // (e.g., products, orders). A more robust solution would involve a recursive
    // delete function or background process, which is more complex.
    // For now, this removes primary access and personal info.

    logger.info(`Successfully deleted account and profile for user ${userId}.`);
    return {success: true};
  } catch (error) {
    logger.error(`Error deleting account for user ${userId}:`, error);
    throw new HttpsError("internal", "Could not delete account.");
  }
});
