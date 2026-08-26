import { availableStock, canFulfil, orderedQuantity } from '@/lib/stock';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  verifyIdToken,
  firestoreGet,
  firestoreQuery,
  firestoreUpdate,
  firestoreCreate,
} from '@/lib/firebase-admin';
import { sendOrderConfirmation, sendSellerOrderNotification, sendAdminNewOrder } from '@/lib/email';
import { paymentIntentLimiter, applyRateLimit } from '@/lib/rate-limit';
import { validateCoupon } from '@/lib/coupons';
import { acceptedOfferPrice } from '@/lib/offer-pricing';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) throw new Error('Stripe secret key not configured.');
  return new Stripe(key, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion });
}

async function calculateOrderTotal(
  items: any[],
  couponCode: string | undefined,
  idToken: string,
  /** The buyer, so an accepted offer on a line can be honoured. */
  buyerId?: string,
) {
  let subtotal = 0;
  const sellerIds = new Set<string>();
  const validatedItems: any[] = [];

  for (const item of items) {
    const lookupId = item.productId || item.id;
    const pData = await firestoreGet('products', lookupId, idToken);
    // Same guard as /api/create-order: a listing with no stock left must not
    // reach a payment intent, whatever its status says.
    if (!pData || !['active', 'reserved'].includes(pData.status) || !canFulfil(pData, item)) {
      console.warn('[create-payment-intent] item rejected', {
        title: item.title,
        lookupId,
        status: pData?.status,
        available: availableStock(pData, item.selectedSize || item.size),
        wanted: orderedQuantity(item),
      });
      throw new Error(`Item "${item.title}" is no longer available.`);
    }
    // An accepted offer overrides the asking price — resolved from the offer
    // document, never taken from the basket, so the discount is one the seller
    // actually agreed to rather than one the client asked for.
    const agreed = buyerId ? await acceptedOfferPrice(lookupId, buyerId, idToken) : null;
    const linePrice = agreed ?? pData.price ?? 0;
    subtotal += linePrice;
    if (pData.sellerId) sellerIds.add(pData.sellerId);
    validatedItems.push({ ...item, price: linePrice, offerApplied: agreed != null });
  }

  const settings = await firestoreGet('settings', 'global', idToken);
  let shippingFee = items.length * 10.9;
  if (settings?.isFreeDeliveryActive && subtotal >= (settings?.freeDeliveryThreshold || 0)) {
    shippingFee = 0;
  }

  // Coupon eligibility is decided here, not in the browser. validateCoupon()
  // is the same function the cart calls for instant feedback, but only this
  // side changes what anyone is charged.
  let discount = 0;
  if (couponCode) {
    const coupons = await firestoreQuery('coupons', 'code', couponCode.toUpperCase(), idToken);
    if (coupons.length > 0) {
      const { id: couponDocId, data: coupon } = coupons[0];

      // Only a first-order coupon needs the buyer's history, so the query is
      // paid for only when one is actually presented.
      let priorOrderCount = 0;
      if (coupon.firstOrderOnly && buyerId) {
        const prior = await firestoreQuery('orders', 'buyerId', buyerId, idToken, 5);
        // A cancelled order should not burn someone's welcome discount.
        priorOrderCount = prior.filter((o) => o.data?.status !== 'cancelled').length;
      }

      const result = validateCoupon({ id: couponDocId, ...coupon } as any, {
        subtotal,
        priorOrderCount,
      });
      if (result.ok) {
        discount = result.discount;
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
  // Rate limit: 10 requests per minute per IP
  const rateLimitResponse = applyRateLimit(req, paymentIntentLimiter);
  if (rateLimitResponse) return rateLimitResponse;

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
      idToken,
      buyerId,
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

    // Decrement stock by the ordered amount (mirrors the COD path in
    // create-order). Listings with remaining stock stay buyable; only when
    // quantity hits zero do we flip to "reserved" so the listing stays
    // visible but can't be ordered again.
    await Promise.all(
      validatedItems.map(async (item: any) => {
        const p = await firestoreGet('products', item.productId || item.id, idToken);
        const currentQty = typeof p?.quantity === 'number' ? p.quantity : 1;
        const orderedQty =
          typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
        const remaining = Math.max(0, currentQty - orderedQty);
        const update: Record<string, unknown> = { quantity: remaining };
        if (remaining === 0) update.status = 'reserved';
        // Multi-variant listings: decrement the matching size's stock alongside
        // the top-level quantity so the size picker stays in sync.
        const variants = Array.isArray(p?.variants) ? p.variants : null;
        const itemSize = item.selectedSize || item.size;
        if (variants && itemSize) {
          update.variants = variants.map((v: any) =>
            v?.size === itemSize
              ? { ...v, quantity: Math.max(0, (Number(v.quantity) || 0) - orderedQty) }
              : v
          );
        }
        await firestoreUpdate('products', item.productId || item.id, update, idToken);
      }),
    );

    // Create order document
    const createdAt = new Date().toISOString();
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
        createdAt,
        statusHistory: [{ status: 'pending_payment', at: createdAt, by: buyerId }],
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
          orderId,
          items: validatedItems.filter((i: any) => i.sellerId === sellerId),
          totalAmount: total,
        }).catch(console.error);
      }
      const firstItem: any = validatedItems[0] || {};
      const productTitle: string = firstItem.title || `#${orderNumber}`;
      const sellerNotifData = firstItem.image
        ? { link: `/profile/listings/sales/${orderId}`, imageUrl: firstItem.image }
        : { link: `/profile/listings/sales/${orderId}` };
      firestoreCreate(
        'notifications',
        {
          userId: sellerId,
          title: `New sale — ${productTitle}`,
          message: 'You have a new order to prepare.',
          type: 'order_update',
          read: false,
          createdAt,
          data: sellerNotifData,
        },
        idToken,
      ).catch((e) => console.warn('seller notification failed', e));
    }

    // In-app notification for the buyer.
    {
      const firstItem: any = validatedItems[0] || {};
      const productTitle: string = firstItem.title || `#${orderNumber}`;
      const buyerData = firstItem.image
        ? { link: `/profile/orders/${orderId}`, imageUrl: firstItem.image }
        : { link: `/profile/orders/${orderId}` };
      firestoreCreate(
        'notifications',
        {
          userId: buyerId,
          title: `${productTitle} — Order placed`,
          message: 'Your order has been received.',
          type: 'order_update',
          read: false,
          createdAt,
          data: buyerData,
        },
        idToken,
      ).catch((e) => console.warn('buyer notification failed', e));
    }

    // Operational alert. The card is authorised, not captured, at this point —
    // the template says so, because an admin reading this must not assume the
    // money has moved.
    sendAdminNewOrder({
      orderNumber,
      orderId,
      buyerName: buyerData?.displayName || buyerData?.name,
      buyerEmail: buyerData?.email,
      items: validatedItems,
      totalAmount: total,
      paymentMethod: 'card',
      sellerCount: sellerIds.length,
      shippingAddress,
    }).catch(console.error);

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
