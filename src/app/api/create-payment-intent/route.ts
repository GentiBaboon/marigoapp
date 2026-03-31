import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  verifyIdToken,
  firestoreGet,
  firestoreQuery,
  firestoreUpdate,
  firestoreCreate,
} from '@/lib/firebase-admin';
import { sendOrderConfirmation, sendSellerOrderNotification } from '@/lib/mailtrap';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) throw new Error('Stripe secret key not configured.');
  return new Stripe(key, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion });
}

async function calculateOrderTotal(
  items: any[],
  couponCode: string | undefined,
  idToken: string
) {
  let subtotal = 0;
  const sellerIds = new Set<string>();
  const validatedItems: any[] = [];

  for (const item of items) {
    const pData = await firestoreGet('products', item.id, idToken);
    if (!pData || !['active', 'reserved'].includes(pData.status)) {
      throw new Error(`Item "${item.title}" is no longer available.`);
    }
    subtotal += pData.price || 0;
    if (pData.sellerId) sellerIds.add(pData.sellerId);
    validatedItems.push({ ...item, price: pData.price || item.price });
  }

  const settings = await firestoreGet('settings', 'global', idToken);
  let shippingFee = items.length * 10.9;
  if (settings?.isFreeDeliveryActive && subtotal >= (settings?.freeDeliveryThreshold || 0)) {
    shippingFee = 0;
  }

  let discount = 0;
  if (couponCode) {
    const coupons = await firestoreQuery('coupons', 'code', couponCode.toUpperCase(), idToken);
    if (coupons.length > 0) {
      const { id: couponDocId, data: coupon } = coupons[0];
      if (coupon.isActive && subtotal >= (coupon.minOrderValue || 0)) {
        discount =
          coupon.type === 'percentage' ? (subtotal * coupon.value) / 100 : coupon.value;
        await firestoreUpdate(
          'coupons',
          couponDocId,
          { usedCount: (coupon.usedCount || 0) + 1 },
          idToken
        );
      }
    }
  }

  const total = Math.max(0, subtotal + shippingFee - discount);
  return {
    subtotal,
    shippingFee,
    discount,
    total,
    sellerIds: Array.from(sellerIds),
    validatedItems,
  };
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token.' }, { status: 401 });
    }

    const buyerId = decoded.sub;
    const stripe = getStripe();

    const body = await req.json();
    const { items, shippingAddress, paymentMethodId, couponCode } = body;

    if (!items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const { total, sellerIds, discount, validatedItems } = await calculateOrderTotal(
      items,
      couponCode,
      idToken
    );

    const totalInCents = Math.round(total * 100);
    if (totalInCents < 50) {
      return NextResponse.json({ error: 'Order total must be at least €0.50.' }, { status: 400 });
    }

    // Get or create Stripe customer
    const buyerData = await firestoreGet('users', buyerId, idToken);
    let customerId = buyerData?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: buyerData?.email || undefined,
        name: buyerData?.name || undefined,
        metadata: { firebaseUid: buyerId },
      });
      customerId = customer.id;
      await firestoreUpdate('users', buyerId, { stripeCustomerId: customerId }, idToken);
    }

    const orderNumber = `MG-${Date.now()}`;

    const piOptions: Stripe.PaymentIntentCreateParams = {
      amount: totalInCents,
      currency: 'eur',
      capture_method: 'manual', // Escrow: hold funds, capture after delivery
      customer: customerId,
      metadata: {
        buyerId,
        sellerIds: sellerIds.join(','),
        orderNumber,
        itemCount: String(items.length),
      },
      description: `Marigo Luxe Purchase - ${orderNumber}`,
    };

    if (paymentMethodId) piOptions.payment_method = paymentMethodId;

    const pi = await stripe.paymentIntents.create(piOptions);

    // Reserve products
    await Promise.all(
      items.map((item: any) =>
        firestoreUpdate('products', item.id, { status: 'reserved' }, idToken)
      )
    );

    // Create order document
    const orderId = await firestoreCreate(
      'orders',
      {
        orderNumber,
        buyerId,
        sellerIds,
        items: validatedItems,
        totalAmount: total,
        discountAmount: discount,
        couponCode: couponCode || null,
        status: 'pending_payment',
        paymentIntentId: pi.id,
        paymentMethod: 'card',
        shippingAddress,
        createdAt: new Date().toISOString(),
      },
      idToken
    );

    // Send emails (non-blocking)
    if (buyerData?.email) {
      sendOrderConfirmation({
        buyerEmail: buyerData.email,
        buyerName: buyerData.name || 'Customer',
        orderNumber,
        orderId,
        items: validatedItems,
        totalAmount: total,
        paymentMethod: 'card',
        shippingAddress,
      }).catch(console.error);
    }

    for (const sellerId of sellerIds) {
      const sellerData = await firestoreGet('users', sellerId, idToken).catch(() => null);
      if (sellerData?.email) {
        sendSellerOrderNotification({
          sellerEmail: sellerData.email,
          sellerName: sellerData.name || 'Seller',
          orderNumber,
          items: validatedItems.filter((i: any) => i.sellerId === sellerId),
          totalAmount: total,
        }).catch(console.error);
      }
    }

    return NextResponse.json({ clientSecret: pi.client_secret, orderId });
  } catch (err: any) {
    console.error('create-payment-intent error:', err);
    if (err.type === 'StripeCardError') {
      return NextResponse.json(
        { error: err.message || 'Your card was declined.' },
        { status: 402 }
      );
    }
    if (err.type === 'StripeAuthenticationError') {
      return NextResponse.json(
        { error: 'Payment service configuration issue. Please contact support.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Payment processing failed. Please try again.' },
      { status: 500 }
    );
  }
}
