import * as admin from "firebase-admin";
import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";

initializeApp();
const db = admin.firestore();

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) {
    throw new HttpsError("failed-precondition", "Payment service is not configured. Contact support.");
  }
  return new Stripe(key, {
    apiVersion: "2024-06-20",
  });
};

/**
 * Input validation helpers
 */
function validateItems(items: any[]): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "Order must contain at least one item.");
  }
  if (items.length > 50) {
    throw new HttpsError("invalid-argument", "Order cannot contain more than 50 items.");
  }
  for (const item of items) {
    if (!item.id || typeof item.id !== "string") {
      throw new HttpsError("invalid-argument", "Each item must have a valid ID.");
    }
  }
}

function validateShippingAddress(addr: any): void {
  if (!addr || typeof addr !== "object") {
    throw new HttpsError("invalid-argument", "Shipping address is required.");
  }
  const required = ["fullName", "address", "city", "postal", "country"];
  for (const field of required) {
    if (!addr[field] || typeof addr[field] !== "string" || addr[field].trim().length === 0) {
      throw new HttpsError("invalid-argument", `Shipping address field '${field}' is required.`);
    }
  }
}

/**
 * Order Automation Trigger
 * Handles notifications and product status updates
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

  // 1. Manage Product Inventory Status
  if (["paid", "processing", "shipped"].includes(newStatus)) {
      const items = newValue.items || [];
      const batch = db.batch();
      items.forEach((item: any) => {
          const productRef = db.collection("products").doc(item.id);
          batch.update(productRef, { status: "sold", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
  }

  // 2. Notifications
  const notify = async (userId: string, title: string, message: string, type: string) => {
      await db.collection("notifications").add({
          userId, title, message, type, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: { orderId, link: `/profile/orders/${orderId}` }
      });
  };

  switch (newStatus) {
    case "paid":
    case "processing":
      await notify(sellerId, "Item Sold!", `Order #${orderNumber} is confirmed. Please prepare for shipping.`, "item_sold");
      break;
    case "shipped":
      await notify(buyerId, "Item Shipped!", `Order #${orderNumber} is on its way.`, "order_update");
      break;
    case "delivered":
      await notify(buyerId, "Order Delivered", `Please confirm receipt for Order #${orderNumber}.`, "order_update");
      break;
    case "completed":
      await notify(sellerId, "Payment Released", `Funds for Order #${orderNumber} are now available in your balance.`, "payment_received");
      break;
  }
});

/**
 * Secure calculation helper with coupon usage tracking
 */
async function calculateOrderTotal(items: any[], couponCode?: string, buyerId?: string) {
    let subtotal = 0;
    const sellerIds = new Set<string>();
    const verifiedItems: any[] = [];

    for (const item of items) {
        const pSnap = await db.collection("products").doc(item.id).get();
        const pData = pSnap.data();

        if (!pSnap.exists || !pData || !['active', 'reserved'].includes(pData.status)) {
            throw new HttpsError("failed-precondition", `Item "${item.title || item.id}" is no longer available.`);
        }

        if (typeof pData.price !== 'number' || pData.price <= 0) {
            throw new HttpsError("failed-precondition", `Item "${item.title || item.id}" has an invalid price.`);
        }

        subtotal += pData.price;
        if (pData.sellerId) sellerIds.add(pData.sellerId);
        verifiedItems.push({ ...item, price: pData.price, sellerId: pData.sellerId });
    }

    // Prevent buying your own items
    if (buyerId && sellerIds.has(buyerId)) {
        throw new HttpsError("failed-precondition", "You cannot purchase your own items.");
    }

    // Shipping fee logic
    const settingsSnap = await db.collection("settings").doc("global").get();
    const settings = settingsSnap.data();
    let shippingFee = 10.90;
    if (settings?.isFreeDeliveryActive && subtotal >= (settings?.freeDeliveryThreshold || 0)) {
        shippingFee = 0;
    }

    // Coupon logic with usage tracking
    let discount = 0;
    let couponRef: admin.firestore.DocumentReference | null = null;
    if (couponCode) {
        const cSnap = await db.collection("coupons").where("code", "==", couponCode.toUpperCase()).limit(1).get();
        if (!cSnap.empty) {
            const couponDoc = cSnap.docs[0];
            const coupon = couponDoc.data();
            couponRef = couponDoc.ref;

            if (!coupon.isActive) {
                throw new HttpsError("failed-precondition", "This coupon is no longer active.");
            }

            // Check usage limit
            if (coupon.maxUses && (coupon.usedCount || 0) >= coupon.maxUses) {
                throw new HttpsError("failed-precondition", "This coupon has reached its usage limit.");
            }

            // Check expiry date
            if (coupon.expiresAt && coupon.expiresAt.toDate() < new Date()) {
                throw new HttpsError("failed-precondition", "This coupon has expired.");
            }

            if (subtotal >= (coupon.minOrderValue || 0)) {
                discount = coupon.type === 'percentage'
                    ? Math.min((subtotal * coupon.value) / 100, coupon.maxDiscount || Infinity)
                    : coupon.value;
            }
        }
    }

    const total = Math.max(0, subtotal + shippingFee - discount);

    return { subtotal, shippingFee, discount, total, sellerIds: Array.from(sellerIds), verifiedItems, couponRef };
}

/**
 * Creates PaymentIntent for Escrow with transactional safety
 */
export const createPaymentIntent = onCall({secrets: ["STRIPE_SECRET_KEY"], minInstances: 1}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");

  const {items, shippingAddress, paymentMethodId, couponCode} = request.data;

  // Input validation
  validateItems(items);
  validateShippingAddress(shippingAddress);

  const stripe = getStripe();
  const buyerId = request.auth.uid;

  try {
    const { total, sellerIds, discount, verifiedItems, couponRef } = await calculateOrderTotal(items, couponCode, buyerId);
    const totalInCents = Math.round(total * 100);

    if (totalInCents < 50) {
      throw new HttpsError("failed-precondition", "Order total is too low for card payment.");
    }

    const buyerSnap = await db.collection("users").doc(buyerId).get();
    const customerId = buyerSnap.data()?.stripeCustomerId;
    const orderNumber = `MG-${Date.now()}`;

    // 1. Create order FIRST (pending_payment) before charging
    const orderRef = await db.collection("orders").add({
      orderNumber,
      buyerId,
      sellerIds,
      items: verifiedItems,
      totalAmount: total,
      discountAmount: discount,
      couponCode: couponCode || null,
      status: "pending_payment",
      paymentMethod: 'card',
      shippingAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Increment coupon usage atomically
    if (couponRef) {
      await couponRef.update({
        usedCount: admin.firestore.FieldValue.increment(1),
      });
    }

    // 3. Create payment intent AFTER order exists
    const piOptions: Stripe.PaymentIntentCreateParams = {
      amount: totalInCents,
      currency: "eur",
      capture_method: "manual", // ESCROW: We hold the funds manually
      metadata: { buyerId, sellerIds: sellerIds.join(','), orderNumber, orderId: orderRef.id },
      description: `Marigo Luxe Purchase (${items.length} items)`
    };

    if (customerId) piOptions.customer = customerId;
    if (paymentMethodId) piOptions.payment_method = paymentMethodId;

    const pi = await stripe.paymentIntents.create(piOptions);

    // 4. Update order with payment intent ID
    await orderRef.update({ paymentIntentId: pi.id });

    return { clientSecret: pi.client_secret, orderId: orderRef.id };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    logger.error("createPaymentIntent error", { message: error.message, stack: error.stack });
    throw new HttpsError("internal", "Payment processing failed. Please try again.");
  }
});

/**
 * Creates Standard Order (COD)
 */
export const createOrder = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");

  const {items, shippingAddress, couponCode} = request.data;

  // Input validation
  validateItems(items);
  validateShippingAddress(shippingAddress);

  const buyerId = request.auth.uid;

  try {
    const { total, sellerIds, discount, verifiedItems, couponRef } = await calculateOrderTotal(items, couponCode, buyerId);

    const orderRef = await db.collection("orders").add({
      orderNumber: `MG-COD-${Date.now()}`,
      buyerId,
      sellerIds,
      items: verifiedItems,
      totalAmount: total,
      discountAmount: discount,
      couponCode: couponCode || null,
      status: 'processing', // COD moves straight to processing
      paymentMethod: 'cod',
      shippingAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Increment coupon usage atomically
    if (couponRef) {
      await couponRef.update({
        usedCount: admin.firestore.FieldValue.increment(1),
      });
    }

    return { success: true, orderId: orderRef.id };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    logger.error("createOrder error", { message: error.message, stack: error.stack });
    throw new HttpsError("internal", "Order creation failed. Please try again.");
  }
});

export const getSellerBalance = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  const stripe = getStripe();
  const uid = request.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const accountId = userDoc.data()?.stripeAccountId;
    if (!accountId) return { available: 0, pending: 0 };

    const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
    const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
    const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

    return { available, pending };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    logger.error("getSellerBalance error", { uid, message: error.message });
    throw new HttpsError("internal", "Failed to retrieve balance. Please try again.");
  }
});

export const requestPayout = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  const stripe = getStripe();
  const uid = request.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const accountId = userDoc.data()?.stripeAccountId;
    if (!accountId) throw new HttpsError("failed-precondition", "No connected account.");

    const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
    const amount = balance.available.find(b => b.currency === 'eur')?.amount || 0;
    if (amount <= 0) throw new HttpsError("failed-precondition", "No funds available.");

    await stripe.payouts.create({ amount, currency: 'eur' }, { stripeAccount: accountId });
    return { success: true };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    logger.error("requestPayout error", { uid, message: error.message });
    throw new HttpsError("internal", "Payout request failed. Please try again.");
  }
});
