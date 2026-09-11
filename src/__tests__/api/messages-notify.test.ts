import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockVerify = vi.fn();
const mockGet = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  verifyIdToken: (...a: any[]) => mockVerify(...a),
  firestoreGet: (...a: any[]) => mockGet(...a),
}));
const mockSend = vi.fn();
vi.mock('@/lib/email', () => ({
  sendMessageNotification: (...a: any[]) => mockSend(...a),
}));
vi.mock('@/lib/rate-limit', () => ({
  messageMailLimiter: {},
  applyRateLimit: () => null,
}));
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({ status: init?.status ?? 200, body }),
  },
}));

import { POST } from '@/app/api/messages/notify/route';

const req = (body: any, token: string | null = 'tok') =>
  ({
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : null) },
    json: async () => body,
  }) as any;

const CONV = {
  participants: ['buyer1', 'seller1'],
  participantDetails: [
    { userId: 'buyer1', name: 'Ana' },
    { userId: 'seller1', name: 'Saras Closet' },
  ],
  productTitle: 'Zara Tennis Dress',
  lastMessage: 'Is this still available?',
  unreadCount: { seller1: 1, buyer1: 0 },
};

function docs(over: Record<string, any> = {}) {
  const table: Record<string, any> = {
    'users/buyer1': { status: 'active', email: 'ana@example.com' },
    'users/seller1': { status: 'active', email: 'seller@example.com', displayName: 'Saras Closet' },
    'conversations/c1': CONV,
    ...over,
  };
  mockGet.mockImplementation(async (col: string, id: string) => table[`${col}/${id}`] ?? null);
}

beforeEach(() => {
  mockVerify.mockReset();
  mockGet.mockReset();
  mockSend.mockReset().mockResolvedValue({ ok: true });
  mockVerify.mockResolvedValue({ sub: 'buyer1', uid: 'buyer1', email: 'ana@example.com' });
});

describe('POST /api/messages/notify', () => {
  it('mails the other participant when this is their first unread message', async () => {
    docs();
    const res: any = await POST(req({ conversationId: 'c1' }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, mailed: true });
    expect(mockSend).toHaveBeenCalledWith({
      recipientEmail: 'seller@example.com',
      recipientName: 'Saras Closet',
      senderName: 'Ana',
      productTitle: 'Zara Tennis Dress',
      preview: 'Is this still available?',
      conversationId: 'c1',
    });
  });

  it('does not mail again while earlier messages are still unread', async () => {
    docs({ 'conversations/c1': { ...CONV, unreadCount: { seller1: 4 } } });
    const res: any = await POST(req({ conversationId: 'c1' }));
    expect(res.body).toEqual({ ok: true, mailed: false, reason: 'already_unread' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not mail a recipient who is reading live (already at zero)', async () => {
    docs({ 'conversations/c1': { ...CONV, unreadCount: { seller1: 0 } } });
    const res: any = await POST(req({ conversationId: 'c1' }));
    expect(res.body.reason).toBe('read');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('answers 404 to a non-participant, like the rules would', async () => {
    mockVerify.mockResolvedValue({ sub: 'stranger', uid: 'stranger' });
    docs({ 'users/stranger': { status: 'active' } });
    const res: any = await POST(req({ conversationId: 'c1' }));
    expect(res.status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('refuses a banned sender', async () => {
    docs({ 'users/buyer1': { status: 'banned', email: 'ana@example.com' } });
    const res: any = await POST(req({ conversationId: 'c1' }));
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe('account_banned');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips a closed dispute thread and a recipient with no address', async () => {
    docs({ 'conversations/c1': { ...CONV, caseClosed: true } });
    expect(((await POST(req({ conversationId: 'c1' }))) as any).body.reason).toBe('closed');
    docs({ 'users/seller1': { status: 'active' } });
    expect(((await POST(req({ conversationId: 'c1' }))) as any).body.reason).toBe('no_email');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects a missing token and a malformed id', async () => {
    docs();
    expect(((await POST(req({ conversationId: 'c1' }, null))) as any).status).toBe(401);
    expect(((await POST(req({ conversationId: '../x' }))) as any).status).toBe(400);
  });
});
