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
  /**
   * Whether to spend the coupon's use here.
   *
   * False on the card path: this runs before the card is confirmed, so an
   * abandoned checkout burned a single-use code for an order that never
   * happened. `/api/confirm-order` spends it once the money is held.
   */
  consumeCoupon = true,
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
        if (consumeCoupon) {
          await firestoreUpdate(
            'coupons',
            couponDocId,
            { usedCount: (coupon.usedCount || 0) + 1 },
            idToken
          );
        }
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
      // Validated and discounted, but not spent — the card has not been
      // confirmed yet. /api/confirm-order spends it.
      false,
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

    // Stock is deliberately NOT taken here.
    //
    // This runs before `stripe.confirmCardPayment`, so decrementing at this
    // point reserved the listing on the strength of an intent to pay. A
    // declined card, a closed tab or an abandoned 3DS step then left it
    // reserved with nothing to put it back: the webhook that handles
    // `payment_intent.canceled` is 403'd by the org policy (docs/payments-status.md),
    // and there is no sweep for stale intents. Listings stayed unbuyable
    // indefinitely, and the buyer could not even retry.
    //
    // `/api/confirm-order` takes the stock instead, once Stripe confirms the
    // money is really held. An abandoned checkout now touches no inventory at
    // all — the order simply stays `pending_payment` and the item stays live.

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

    // No emails, no notifications, no coupon spend here.
    //
    // All of it used to fire before `stripe.confirmCardPayment`, so an
    // abandoned or declined checkout still told the buyer their order was
    // confirmed, told the seller they had sold the item, and alerted the
    // operator to a sale — for money that never arrived. Telling a seller
    // their item is gone when it is not is the worst of those.
    //
    // /api/confirm-order does all of it, once Stripe says the money is held.

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
