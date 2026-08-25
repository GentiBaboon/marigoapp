import { NextRequest, NextResponse } from 'next/server';
import {
  verifyIdToken,
  firestoreGet,
  firestoreQuery,
  firestoreUpdate,
  firestoreCreate,
} from '@/lib/firebase-admin';
import { calculateShipping, type ShippableLine } from '@/lib/shipping';
import { sendOrderConfirmation, sendSellerOrderNotification, sendAdminNewOrder } from '@/lib/email';
import { createOrderLimiter, applyRateLimit } from '@/lib/rate-limit';
import { validateCoupon } from '@/lib/coupons';
import { acceptedOfferPrice } from '@/lib/offer-pricing';

async function calculateOrderTotal(
  items: any[],
  couponCode: string | undefined,
  idToken: string,
  /** Delivery country, from the address being shipped to. Decides whether each
   *  parcel pays the domestic or the cross-border rate. */
  destinationCountry?: string | null,
  /** The buyer, so an accepted offer on a line can be honoured. */
  buyerId?: string,
) {
  let subtotal = 0;
  const sellerIds = new Set<string>();
  const validatedItems: any[] = [];
  const shippableLines: ShippableLine[] = [];

  for (const item of items) {
    const lookupId = item.productId || item.id;
    const pData = await firestoreGet('products', lookupId, idToken);
    if (!pData || !['active', 'reserved'].includes(pData.status)) {
      console.warn('[create-order] item rejected', {
        title: item.title,
        lookupId,
        rawId: item.id,
        rawProductId: item.productId,
        found: !!pData,
        status: pData?.status,
      });
      throw new Error(`Item "${item.title}" is no longer available.`);
    }
    // An accepted offer overrides the asking price — resolved here from the
    // offer document rather than taken from the basket, so the discount is
    // real and cannot be invented by the client.
    const agreed = buyerId ? await acceptedOfferPrice(lookupId, buyerId, idToken) : null;
    const linePrice = agreed ?? pData.price ?? 0;
    subtotal += linePrice;
    if (pData.sellerId) sellerIds.add(pData.sellerId);
    // Origin city is read off the stored product, never trusted from the
    // request — otherwise a caller could collapse a multi-city order into one
    // delivery fee by editing its own basket payload.
    shippableLines.push({
      sellerId: pData.sellerId || '',
      shippingFromCity: pData.shippingFromCity ?? null,
      shippingFromCountry: pData.shippingFromCountry ?? null,
    });
    validatedItems.push({ ...item, price: linePrice, offerApplied: agreed != null });
  }

  const settings = await firestoreGet('settings', 'global', idToken);
  // One fee per distinct origin city — mirrored by CartContext for display.
  // This side is authoritative: it is what the buyer is charged. Both call the
  // same helper so the quote and the charge cannot disagree.
  const isFreeDelivery = Boolean(
    settings?.isFreeDeliveryActive && subtotal >= (settings?.freeDeliveryThreshold || 0),
  );
  const { totalEur: shippingFee, groups: shippingGroups } = calculateShipping(
    shippableLines,
    { isFree: isFreeDelivery, destinationCountry },
  );

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
  return { subtotal, shippingFee, discount, total, sellerIds: Array.from(sellerIds), validatedItems, shippingGroups };
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const rateLimitResponse = applyRateLimit(req, createOrderLimiter);
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

    const body = await req.json();
    const { items, shippingAddress, couponCode } = body;

    if (!items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const { total, sellerIds, discount, validatedItems } = await calculateOrderTotal(
      items,
      couponCode,
      idToken,
      shippingAddress?.country,
      buyerId,
    );

    const orderNumber = `MG-COD-${Date.now()}`;

    // Decrement stock by the ordered amount. Listings with remaining stock
    // stay "active" (still buyable by other shoppers); only when stock hits
    // zero do we flip the listing to "reserved" so it stays visible on the
    // marketplace but can't be ordered again. The status moves to "sold"
    // once admin marks the order completed, and back to "active" if the
    // order is cancelled/refunded (with quantity restored).
    await Promise.all(
      validatedItems.map(async (item: any) => {
        const p = await firestoreGet('products', item.productId || item.id, idToken);
        const currentQty = typeof p?.quantity === 'number' ? p.quantity : 1;
        const orderedQty =
          typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
        const remaining = Math.max(0, currentQty - orderedQty);
        const update: Record<string, unknown> = { quantity: remaining };
        if (remaining === 0) update.status = 'reserved';
        // Multi-variant listings (Official Brand sellers): decrement the
        // matching size's stock too, so the size picker on the public page
        // reflects what's actually left. If a size match can't be found we
        // still decrement top-level quantity above, which is safer than
        // silently overselling.
        const variants = Array.isArray(p?.variants) ? p.variants : null;
        const itemSize = item.selectedSize || item.size;
        if (variants && itemSize) {
          const nextVariants = variants.map((v: any) =>
            v?.size === itemSize
              ? { ...v, quantity: Math.max(0, (Number(v.quantity) || 0) - orderedQty) }
              : v
          );
          update.variants = nextVariants;
        }
        await firestoreUpdate('products', item.productId || item.id, update, idToken);
      }),
    );

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
        status: 'confirmed',
        paymentMethod: 'cod',
        shippingAddress,
        createdAt,
        statusHistory: [{ status: 'confirmed', at: createdAt, by: buyerId }],
      },
      idToken
    );

    // In-app notifications (best-effort).
    const firstItem: any = validatedItems[0] || {};
    const productTitle: string = firstItem.title || `#${orderNumber}`;
    const buildData = (link: string) =>
      firstItem.image ? { link, imageUrl: firstItem.image } : { link };
    firestoreCreate(
      'notifications',
      {
        userId: buyerId,
        title: `${productTitle} — Order Confirmed`,
        message: 'Your order has been confirmed.',
        type: 'order_update',
        read: false,
        createdAt,
        data: buildData(`/profile/orders/${orderId}`),
      },
      idToken,
    ).catch((e) => console.warn('buyer notification failed', e));
    for (const sellerId of sellerIds) {
      firestoreCreate(
        'notifications',
        {
          userId: sellerId,
          title: `New sale — ${productTitle}`,
          message: 'You have a new order to prepare.',
          type: 'order_update',
          read: false,
          createdAt,
          data: buildData(`/profile/listings/sales/${orderId}`),
        },
        idToken,
      ).catch((e) => console.warn('seller notification failed', e));
    }

    // Send emails (non-blocking — don't fail the order if email fails)
    const buyerData = await firestoreGet('users', buyerId, idToken).catch(() => null);
    if (buyerData?.email) {
      sendOrderConfirmation({
        buyerEmail: buyerData.email,
        buyerName: buyerData.name || 'Customer',
        orderNumber,
        orderId,
        items: validatedItems,
        totalAmount: total,
        paymentMethod: 'cod',
        shippingAddress,
      }).catch(console.error);
    }

    // Notify sellers
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
    }

    // Operational alert. Sent from here rather than from the browser because
    // the totals were computed on this side — the platform inbox should see
    // the figure the buyer was actually charged.
    sendAdminNewOrder({
      orderNumber,
      orderId,
      buyerName: buyerData?.displayName || buyerData?.name,
      buyerEmail: buyerData?.email,
      items: validatedItems,
      totalAmount: total,
      paymentMethod: 'cod',
      sellerCount: sellerIds.length,
      shippingAddress,
    }).catch(console.error);

    return NextResponse.json({ success: true, orderId });
  } catch (err: any) {
    console.error('create-order error:', err);
    return NextResponse.json(
      { error: err.message || 'Order creation failed. Please try again.' },
      { status: 500 }
    );
  }
}
