import { decrementStockForItems } from '@/lib/inventory-server';
import { availableStock, canFulfil, orderedQuantity } from '@/lib/stock';
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
    // Status *and* stock. Status alone let a listing that was `active` with
    // quantity 0 through — the decrement below then recomputed `remaining` as
    // 0 and flipped it back to `reserved`, so the same single unit could be
    // sold over and over.
    if (!pData || !['active', 'reserved'].includes(pData.status) || !canFulfil(pData, item)) {
      console.warn('[create-order] item rejected', {
        title: item.title,
        lookupId,
        rawId: item.id,
        rawProductId: item.productId,
        found: !!pData,
        status: pData?.status,
        available: availableStock(pData, item.selectedSize || item.size),
        wanted: orderedQuantity(item),
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
        // Best effort, like /api/confirm-order. This runs with the *buyer's*
        // token (there is no service account), and until the coupons rule
        // allowed a +1 on `usedCount` it was a 403 — which, awaited here,
        // failed the whole cash-on-delivery order for anyone presenting
        // WELCOME10. A counter must never stand between a buyer and their
        // order; `firstOrderOnly` is enforced from the buyer's own order
        // history above, not from this number.
        try {
          await firestoreUpdate(
            'coupons',
            couponDocId,
            { usedCount: (coupon.usedCount || 0) + 1 },
            idToken
          );
        } catch (e) {
          console.warn('[create-order] coupon usage not recorded', e);
        }
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

    const { total, subtotal, shippingFee, sellerIds, discount, validatedItems } = await calculateOrderTotal(
      items,
      couponCode,
      idToken,
      shippingAddress?.country,
      buyerId,
    );

    const orderNumber = `MG-COD-${Date.now()}`;

    const createdAt = new Date().toISOString();
    const orderId = await firestoreCreate(
      'orders',
      {
        orderNumber,
        buyerId,
        sellerIds,
        items: validatedItems,
        totalAmount: total,
        // Stored apart so finance can tell goods from the courier's fee.
        subtotal,
        shippingFee,
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

    // Stock comes off *after* the order exists, never before.
    //
    // Cash on delivery is committed the moment it is placed, so the stock does
    // come off in this request — but the decrement used to run first, and any
    // failure writing the order then left the listing reserved with nothing
    // recording why. No order meant no admin screen could release it either,
    // since every release path starts from an order's line items. This is the
    // same ordering /api/confirm-order uses: the durable record first, the
    // inventory second, so a crash between them loses stock rather than
    // stranding it.
    await decrementStockForItems(validatedItems, idToken);

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
