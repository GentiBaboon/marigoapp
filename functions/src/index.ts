import * as admin from "firebase-admin";
import {initializeApp} from "firebase-admin/app";
import {onCall, HttpsError} from "firebase-functions/v2/https";
// import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";

initializeApp();
const db = admin.firestore();

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key || key === "sk_test_your_key_here") {
    throw new HttpsError("failed-precondition", "STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(key, {
    apiVersion: "2024-06-20",
  });
};

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
 * Secure calculation helper
 */
async function calculateOrderTotal(items: any[], couponCode?: string) {
    let subtotal = 0;
    const sellerIds = new Set<string>();
    
    for (const item of items) {
        const pSnap = await db.collection("products").doc(item.id).get();
        const pData = pSnap.data();
        
        if (!pSnap.exists || !['active', 'reserved'].includes(pData?.status)) {
            throw new HttpsError("failed-precondition", `Item "${item.title}" is no longer available.`);
        }
        
        subtotal += pData?.price || 0;
        if (pData?.sellerId) sellerIds.add(pData.sellerId);
    }

    // Shipping fee logic
    const settingsSnap = await db.collection("settings").doc("global").get();
    const settings = settingsSnap.data();
    let shippingFee = 10.90;
    if (settings?.isFreeDeliveryActive && subtotal >= (settings?.freeDeliveryThreshold || 0)) {
        shippingFee = 0;
    }

    // Coupon logic
    let discount = 0;
    if (couponCode) {
        const cSnap = await db.collection("coupons").where("code", "==", couponCode.toUpperCase()).limit(1).get();
        if (!cSnap.empty) {
            const coupon = cSnap.docs[0].data();
            if (coupon.isActive && subtotal >= (coupon.minOrderValue || 0)) {
                discount = coupon.type === 'percentage' ? (subtotal * coupon.value) / 100 : coupon.value;
            }
        }
    }

    const total = Math.max(0, subtotal + shippingFee - discount);
    
    return { subtotal, shippingFee, discount, total, sellerIds: Array.from(sellerIds) };
}

/**
 * Creates PaymentIntent for Escrow
 */
export const createPaymentIntent = onCall({secrets: ["STRIPE_SECRET_KEY"], minInstances: 1}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
  
  const {items, shippingAddress, paymentMethodId, couponCode} = request.data;
  const stripe = getStripe();
  const buyerId = request.auth.uid;

  try {
    const { total, sellerIds, discount } = await calculateOrderTotal(items, couponCode);
    const totalInCents = Math.round(total * 100);

    const buyerSnap = await db.collection("users").doc(buyerId).get();
    const customerId = buyerSnap.data()?.stripeCustomerId;

    const piOptions: Stripe.PaymentIntentCreateParams = {
      amount: totalInCents,
      currency: "eur",
      capture_method: "manual", // ESCROW: We hold the funds manually
      metadata: { buyerId, sellerIds: sellerIds.join(','), orderNumber: `MG-${Date.now()}` },
      description: `Marigo Luxe Purchase (${items.length} items)`
    };

    if (customerId) piOptions.customer = customerId;
    if (paymentMethodId) piOptions.payment_method = paymentMethodId;

    const pi = await stripe.paymentIntents.create(piOptions);

    const orderRef = await db.collection("orders").add({
      orderNumber: pi.metadata.orderNumber,
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

    return { clientSecret: pi.client_secret, orderId: orderRef.id };
  } catch (error: any) {
    logger.error("createPaymentIntent error", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Creates Standard Order (COD)
 */
export const createOrder = onCall({secrets: ["STRIPE_SECRET_KEY"]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Access denied.");
  
  const {items, shippingAddress, couponCode} = request.data;
  const buyerId = request.auth.uid;

  try {
    const { total, sellerIds, discount } = await calculateOrderTotal(items, couponCode);

    const orderRef = await db.collection("orders").add({
      orderNumber: `MG-COD-${Date.now()}`,
      buyerId,
      sellerIds,
      items,
      totalAmount: total,
      discountAmount: discount,
      couponCode: couponCode || null,
      status: 'processing', // COD moves straight to processing
      paymentMethod: 'cod',
      shippingAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, orderId: orderRef.id };
  } catch (error: any) {
    logger.error("createOrder error", error);
    throw new HttpsError("internal", error.message);
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
    throw new HttpsError("internal", error.message);
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
    throw new HttpsError("internal", error.message);
  }
});
