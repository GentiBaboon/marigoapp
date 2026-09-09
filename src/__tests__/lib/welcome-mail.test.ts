import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  firestoreGet: (...a: any[]) => mockGet(...a),
  firestoreUpdate: (...a: any[]) => mockUpdate(...a),
}));

const mockSend = vi.fn();
vi.mock('@/lib/email', () => ({
  sendWelcomeEmail: (...a: any[]) => mockSend(...a),
}));

import { sendWelcomeOnce, welcomeName } from '@/lib/welcome-mail';

const base = { uid: 'u1', email: 'elira@example.com', idToken: 'tok' };

beforeEach(() => {
  mockGet.mockReset();
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockSend.mockReset().mockResolvedValue({ ok: true, status: 202 });
});

describe('sendWelcomeOnce', () => {
  it('sends once and stamps the account', async () => {
    mockGet.mockResolvedValue({ displayName: 'Elira' });
    const r = await sendWelcomeOnce(base);
    expect(r).toEqual({ sent: true });
    expect(mockSend).toHaveBeenCalledWith('elira@example.com', { name: 'Elira' });
    expect(mockUpdate).toHaveBeenCalledWith('users', 'u1', { welcomeMailedAt: expect.any(Date) }, 'tok');
  });

  it('is a no-op for an account already welcomed', async () => {
    mockGet.mockResolvedValue({ welcomeMailedAt: '2026-09-01T00:00:00Z' });
    const r = await sendWelcomeOnce(base);
    expect(r).toEqual({ sent: false, reason: 'already_welcomed' });
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('uses a document the caller already holds instead of reading again', async () => {
    const r = await sendWelcomeOnce({ ...base, user: { name: 'E' }, tokenName: 'Token Name' });
    expect(r).toEqual({ sent: true });
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledWith('elira@example.com', { name: 'E' });
  });

  it('does not stamp when the transport skipped or failed, so a later try still sends', async () => {
    mockGet.mockResolvedValue(null);
    mockSend.mockResolvedValueOnce({ ok: false, skipped: true });
    expect(await sendWelcomeOnce(base)).toEqual({ sent: false, reason: 'skipped' });
    mockSend.mockResolvedValueOnce({ ok: false, status: 403, error: 'sender not verified' });
    expect(await sendWelcomeOnce(base)).toEqual({ sent: false, reason: 'failed' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('never throws', async () => {
    mockGet.mockResolvedValue({});
    mockSend.mockRejectedValue(new Error('boom'));
    await expect(sendWelcomeOnce(base)).resolves.toEqual({ sent: false, reason: 'failed' });
    await expect(sendWelcomeOnce({ ...base, email: '' })).resolves.toEqual({ sent: false, reason: 'no_email' });
  });
});

describe('welcomeName', () => {
  it('prefers the profile, then the token, then nothing', () => {
    expect(welcomeName({ displayName: 'A', name: 'B' }, 'C')).toBe('A');
    expect(welcomeName({ name: 'B' }, 'C')).toBe('B');
    expect(welcomeName({}, 'C')).toBe('C');
    expect(welcomeName(null)).toBeUndefined();
  });
});
