import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mintUnsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
  isEssentialCategory,
  ESSENTIAL_CATEGORIES,
} from '@/lib/email/unsubscribe';
import { UNSUBSCRIBE_PLACEHOLDER } from '@/lib/email/layout';
import * as T from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/client';

const SAVED = process.env.UNSUBSCRIBE_SECRET;
beforeEach(() => { process.env.UNSUBSCRIBE_SECRET = 'test-secret'; });
afterEach(() => {
  if (SAVED === undefined) delete process.env.UNSUBSCRIBE_SECRET;
  else process.env.UNSUBSCRIBE_SECRET = SAVED;
});

describe('token', () => {
  it('round-trips an address', () => {
    const t = mintUnsubscribeToken('elira@example.com')!;
    expect(verifyUnsubscribeToken(t)).toBe('elira@example.com');
  });

  it('is case-insensitive on the address', () => {
    const t = mintUnsubscribeToken('Elira@Example.COM')!;
    expect(verifyUnsubscribeToken(t)).toBe('elira@example.com');
  });

  // The whole point: a link is a URL anyone can edit.
  it('refuses a token whose address was swapped', () => {
    const t = mintUnsubscribeToken('elira@example.com')!;
    const [, sig] = t.split('.');
    const forged = `${Buffer.from('victim@example.com').toString('base64url')}.${sig}`;
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it('refuses a tampered signature', () => {
    const t = mintUnsubscribeToken('elira@example.com')!;
    const [enc] = t.split('.');
    expect(verifyUnsubscribeToken(`${enc}.${'0'.repeat(32)}`)).toBeNull();
  });

  it('refuses junk', () => {
    expect(verifyUnsubscribeToken('')).toBeNull();
    expect(verifyUnsubscribeToken('nonsense')).toBeNull();
    expect(verifyUnsubscribeToken('a.b')).toBeNull();
  });

  // A token signed with a different key must not verify.
  it('does not verify across signing keys', () => {
    const t = mintUnsubscribeToken('elira@example.com')!;
    process.env.UNSUBSCRIBE_SECRET = 'a-different-secret';
    expect(verifyUnsubscribeToken(t)).toBeNull();
  });

  it('builds an absolute URL carrying the token', () => {
    const url = unsubscribeUrl('elira@example.com');
    expect(url.startsWith('http')).toBe(true);
    expect(url).toContain('/unsubscribe?u=');
  });
});

describe('every template carries the link', () => {
  const ALL: Array<[string, T.RenderedEmail]> = [
    ['welcome', T.welcomeEmail({ name: 'E' })],
    ['passwordReset', T.passwordResetEmail({ resetLink: 'https://x/r' })],
    ['orderConfirmation', T.orderConfirmationEmail({ orderNumber: 'M1', orderId: 'o1', items: [{ title: 'x', price: 1 }], totalAmount: 1 })],
    ['offerReceived', T.offerReceivedEmail({ productTitle: 'H', amount: 1, offerPath: '/p' })],
    ['adminNewOrder', T.adminNewOrderEmail({ orderNumber: 'M1', orderId: 'o1', items: [{ title: 'x', price: 1 }], totalAmount: 1 })],
    ['adminNewUser', T.adminNewUserEmail({ userId: 'u1' })],
    ['returnResolved', T.returnResolvedEmail({ orderNumber: 'M1', orderId: 'o1', outcome: 'Refunded' })],
  ];

  it.each(ALL)('%s renders the unsubscribe placeholder', (_n, email) => {
    expect(email.html).toContain(UNSUBSCRIBE_PLACEHOLDER);
    expect(email.html).toContain('Unsubscribe');
  });
});

describe('essential categories', () => {
  it('keeps receipts and account mail unsuppressable', () => {
    for (const c of ['password-reset', 'verify-email', 'order-confirmation', 'refund', 'payout']) {
      expect(isEssentialCategory(c)).toBe(true);
    }
  });

  it('treats offers, messages and welcome as optional', () => {
    for (const c of ['welcome', 'offer-received', 'offer-accepted', 'new-message', 'listing-approved']) {
      expect(isEssentialCategory(c)).toBe(false);
    }
  });

  it('treats an unknown category as optional rather than essential', () => {
    expect(isEssentialCategory('something-new')).toBe(false);
    expect(isEssentialCategory(undefined)).toBe(false);
  });

  // Admin alerts must not be silenced by a customer's opt-out.
  it('protects the admin alerts', () => {
    expect(ESSENTIAL_CATEGORIES.has('admin-new-order')).toBe(true);
    expect(ESSENTIAL_CATEGORIES.has('admin-order-cancelled')).toBe(true);
    expect(ESSENTIAL_CATEGORIES.has('admin-new-user')).toBe(true);
  });
});

describe('transport', () => {
  const KEY = process.env.SENDGRID_API_KEY;
  const GROUP = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID;
  beforeEach(() => { vi.restoreAllMocks(); process.env.SENDGRID_API_KEY = 'SG.test'; });
  afterEach(() => {
    if (KEY === undefined) delete process.env.SENDGRID_API_KEY; else process.env.SENDGRID_API_KEY = KEY;
    if (GROUP === undefined) delete process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID; else process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID = GROUP;
  });

  async function capture(payload: Parameters<typeof sendEmail>[0]) {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 202 }) as any);
    await sendEmail(payload);
    return JSON.parse((spy.mock.calls[0][1] as any).body);
  }

  it('substitutes a signed link for the placeholder', async () => {
    const body = await capture({ to: 'a@b.com', subject: 's', html: T.welcomeEmail({}).html });
    expect(body.content[1].value).not.toContain(UNSUBSCRIBE_PLACEHOLDER);
    expect(body.content[1].value).toContain('/unsubscribe?u=');
  });

  // A placeholder left in the text part would be visible gibberish.
  it('substitutes in the plain-text part too', async () => {
    const body = await capture({ to: 'a@b.com', subject: 's', html: T.welcomeEmail({}).html });
    expect(body.content[0].value).not.toContain(UNSUBSCRIBE_PLACEHOLDER);
  });

  it('links each recipient to their own token', async () => {
    const a = await capture({ to: 'one@x.com', subject: 's', html: T.welcomeEmail({}).html });
    vi.restoreAllMocks();
    const b = await capture({ to: 'two@x.com', subject: 's', html: T.welcomeEmail({}).html });
    expect(a.content[1].value).not.toBe(b.content[1].value);
  });

  // Gmail and Yahoo bulk-sender rules now expect these.
  it('sets the RFC 8058 one-click headers', async () => {
    const body = await capture({ to: 'a@b.com', subject: 's', html: '<p>x</p>' });
    expect(body.headers['List-Unsubscribe']).toContain('/unsubscribe?u=');
    expect(body.headers['List-Unsubscribe']).toContain('mailto:');
    expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('tags optional mail with the suppression group when one is configured', async () => {
    process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID = '42';
    const body = await capture({ to: 'a@b.com', subject: 's', html: '<p>x</p>', category: 'offer-received' });
    expect(body.asm).toEqual({ group_id: 42 });
  });

  // The group is what keeps a receipt arriving after someone unsubscribes.
  it('never tags essential mail with the group', async () => {
    process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID = '42';
    const body = await capture({ to: 'a@b.com', subject: 's', html: '<p>x</p>', category: 'order-confirmation' });
    expect(body.asm).toBeUndefined();
  });

  it('omits the group entirely when none is configured', async () => {
    delete process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID;
    const body = await capture({ to: 'a@b.com', subject: 's', html: '<p>x</p>', category: 'offer-received' });
    expect(body.asm).toBeUndefined();
  });
});
