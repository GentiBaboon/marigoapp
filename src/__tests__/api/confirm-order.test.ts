import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockVerify = vi.fn();
const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockCreate = vi.fn().mockResolvedValue('n1');
const mockQuery = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/firebase-admin', () => ({
  verifyIdToken: (...a: any[]) => mockVerify(...a),
  firestoreGet: (...a: any[]) => mockGet(...a),
  firestoreUpdate: (...a: any[]) => mockUpdate(...a),
  firestoreCreate: (...a: any[]) => mockCreate(...a),
  firestoreQuery: (...a: any[]) => mockQuery(...a),
}));

const mockBuyerEmail = vi.fn().mockResolvedValue(undefined);
const mockSellerEmail = vi.fn().mockResolvedValue(undefined);
const mockAdminEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email', () => ({
  sendOrderConfirmation: (...a: any[]) => mockBuyerEmail(...a),
  sendSellerOrderNotification: (...a: any[]) => mockSellerEmail(...a),
  sendAdminNewOrder: (...a: any[]) => mockAdminEmail(...a),
}));

const mockRetrieve = vi.fn();
vi.mock('stripe', () => ({
  default: class {
    paymentIntents = { retrieve: (...a: any[]) => mockRetrieve(...a) };
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  paymentIntentLimiter: {},
  applyRateLimit: () => null,
}));

const mockDecrement = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/inventory-server', () => ({
  decrementStockForItems: (...a: any[]) => mockDecrement(...a),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({ status: init?.status ?? 200, body }),
  },
}));

import { POST } from '@/app/api/confirm-order/route';

const req = (body: any, token = 'good-token') =>
  ({
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : null,
    },
    json: async () => body,
  }) as any;

const ORDER = {
  buyerId: 'buyer1',
  status: 'pending_payment',
  paymentIntentId: 'pi_123',
  items: [{ id: 'p1', quantity: 1 }],
  statusHistory: [{ status: 'pending_payment' }],
};

describe('POST /api/confirm-order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    mockVerify.mockResolvedValue({ uid: 'buyer1' });
    mockGet.mockResolvedValue({ ...ORDER });
    mockRetrieve.mockResolvedValue({ status: 'requires_capture' });
    mockUpdate.mockResolvedValue(undefined);
    mockDecrement.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue('n1');
    mockQuery.mockResolvedValue([]);
  });

  it('takes the stock once payment is really held', async () => {
    const res = await POST(req({ orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(mockDecrement).toHaveBeenCalledWith(ORDER.items, 'good-token');
    // Manual capture: a paid escrow order sits at requires_capture.
    expect(mockRetrieve).toHaveBeenCalledWith('pi_123');
  });

  it('moves the order to processing before touching stock', async () => {
    await POST(req({ orderId: 'o1' }));
    // A crash between the two must leave stock untaken, not taken twice.
    expect(mockUpdate.mock.invocationCallOrder[0])
      .toBeLessThan(mockDecrement.mock.invocationCallOrder[0]);
    expect(mockUpdate.mock.calls[0][2]).toMatchObject({ status: 'processing' });
  });

  it('refuses when Stripe says the payment is not complete', async () => {
    mockRetrieve.mockResolvedValue({ status: 'requires_payment_method' });
    const res = await POST(req({ orderId: 'o1' }));
    expect(res.status).toBe(409);
    expect(mockDecrement).not.toHaveBeenCalled();
  });

  it('does not believe the client over Stripe', async () => {
    mockRetrieve.mockResolvedValue({ status: 'canceled' });
    const res = await POST(req({ orderId: 'o1', paid: true, status: 'succeeded' }));
    expect(res.status).toBe(409);
    expect(mockDecrement).not.toHaveBeenCalled();
  });

  it('is a no-op when the order was already confirmed', async () => {
    mockGet.mockResolvedValue({ ...ORDER, status: 'processing' });
    const res = await POST(req({ orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(res.body.alreadyConfirmed).toBe(true);
    expect(mockDecrement).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('will not confirm somebody else’s order', async () => {
    mockGet.mockResolvedValue({ ...ORDER, buyerId: 'someone-else' });
    const res = await POST(req({ orderId: 'o1' }));
    expect(res.status).toBe(404); // not 403 — does not confirm the id exists
    expect(mockDecrement).not.toHaveBeenCalled();
  });

  it('requires a bearer token', async () => {
    const res = await POST(req({ orderId: 'o1' }, ''));
    expect(res.status).toBe(401);
    expect(mockDecrement).not.toHaveBeenCalled();
  });

  it('requires an orderId', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(mockDecrement).not.toHaveBeenCalled();
  });

  it('handles an order with no payment intent', async () => {
    mockGet.mockResolvedValue({ ...ORDER, paymentIntentId: undefined });
    const res = await POST(req({ orderId: 'o1' }));
    expect(res.status).toBe(400);
    expect(mockDecrement).not.toHaveBeenCalled();
  });

  // ── side effects that used to fire before the card was confirmed ──────────

  it('emails the buyer, the seller and the operator only after payment', async () => {
    mockGet.mockImplementation(async (col: string) =>
      col === 'orders'
        ? { ...ORDER, sellerIds: ['s1'], orderNumber: 'MG-1', totalAmount: 50 }
        : { email: 'someone@example.com', name: 'Someone' },
    );
    await POST(req({ orderId: 'o1' }));
    expect(mockBuyerEmail).toHaveBeenCalledTimes(1);
    expect(mockSellerEmail).toHaveBeenCalledTimes(1);
    expect(mockAdminEmail).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when Stripe says the payment did not complete', async () => {
    mockRetrieve.mockResolvedValue({ status: 'requires_payment_method' });
    await POST(req({ orderId: 'o1' }));
    // The seller must never be told they sold something that was not paid for.
    expect(mockSellerEmail).not.toHaveBeenCalled();
    expect(mockBuyerEmail).not.toHaveBeenCalled();
    expect(mockAdminEmail).not.toHaveBeenCalled();
  });

  it('does not re-send on a second call', async () => {
    mockGet.mockResolvedValue({ ...ORDER, status: 'processing' });
    await POST(req({ orderId: 'o1' }));
    expect(mockBuyerEmail).not.toHaveBeenCalled();
    expect(mockSellerEmail).not.toHaveBeenCalled();
  });

  it('spends the coupon use here, not at intent time', async () => {
    mockGet.mockImplementation(async (col: string) =>
      col === 'orders' ? { ...ORDER, couponCode: 'WELCOME10' } : { email: 'b@x.com' },
    );
    mockQuery.mockResolvedValue([{ id: 'c1', data: { usedCount: 4 } }]);
    await POST(req({ orderId: 'o1' }));
    const couponWrite = mockUpdate.mock.calls.find(c => c[0] === 'coupons');
    expect(couponWrite?.[2]).toEqual({ usedCount: 5 });
  });

  it('does not spend a coupon when the payment failed', async () => {
    mockRetrieve.mockResolvedValue({ status: 'canceled' });
    mockGet.mockResolvedValue({ ...ORDER, couponCode: 'WELCOME10' });
    await POST(req({ orderId: 'o1' }));
    expect(mockUpdate.mock.calls.find(c => c[0] === 'coupons')).toBeUndefined();
  });

  it('still succeeds when an email throws', async () => {
    mockGet.mockImplementation(async (col: string) =>
      col === 'orders' ? { ...ORDER } : { email: 'b@x.com' },
    );
    mockBuyerEmail.mockRejectedValueOnce(new Error('sendgrid down'));
    const res = await POST(req({ orderId: 'o1' }));
    // The money is held and the stock is taken; a failed email is not a
    // reason to tell the buyer their order failed.
    expect(res.status).toBe(200);
    expect(mockDecrement).toHaveBeenCalled();
  });
});
