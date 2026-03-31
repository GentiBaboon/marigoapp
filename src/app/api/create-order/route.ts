import { NextRequest, NextResponse } from 'next/server';
import {
  verifyIdToken,
  firestoreGet,
  firestoreQuery,
  firestoreUpdate,
  firestoreCreate,
} from '@/lib/firebase-admin';
import { sendOrderConfirmation, sendSellerOrderNotification } from '@/lib/mailtrap';

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
  return { subtotal, shippingFee, discount, total, sellerIds: Array.from(sellerIds), validatedItems };
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

    const body = await req.json();
    const { items, shippingAddress, couponCode } = body;

    if (!items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const { total, sellerIds, discount, validatedItems } = await calculateOrderTotal(
      items,
      couponCode,
      idToken
    );

    const orderNumber = `MG-COD-${Date.now()}`;

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
        status: 'processing',
        paymentMethod: 'cod',
        shippingAddress,
        createdAt: new Date().toISOString(),
      },
      idToken
    );

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
          items: validatedItems.filter((i: any) => i.sellerId === sellerId),
          totalAmount: total,
        }).catch(console.error);
      }
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err: any) {
    console.error('create-order error:', err);
    return NextResponse.json(
      { error: err.message || 'Order creation failed. Please try again.' },
      { status: 500 }
    );
  }
}
