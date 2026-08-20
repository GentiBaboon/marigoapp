import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as T from '@/lib/email/templates';
import { escapeHtml } from '@/lib/email/layout';
import { htmlToText, sendEmail } from '@/lib/email/client';

const ITEMS = [{ brand: 'Gucci', title: 'Vintage Heels', price: 80 }];

/** Every template, rendered with plausible data. */
const ALL: Array<[string, T.RenderedEmail]> = [
  ['welcome', T.welcomeEmail({ name: 'Elira' })],
  ['passwordReset', T.passwordResetEmail({ name: 'Elira', resetLink: 'https://x/reset' })],
  ['verify', T.emailVerificationEmail({ name: 'Elira', verifyLink: 'https://x/v' })],
  ['orderConfirmation', T.orderConfirmationEmail({ buyerName: 'Elira', orderNumber: 'MG-1', orderId: 'o1', items: ITEMS, totalAmount: 80 })],
  ['orderShipped', T.orderShippedEmail({ orderNumber: 'MG-1', orderId: 'o1' })],
  ['orderDelivered', T.orderDeliveredEmail({ orderNumber: 'MG-1', orderId: 'o1' })],
  ['orderCancelled', T.orderCancelledEmail({ orderNumber: 'MG-1', orderId: 'o1' })],
  ['refund', T.refundIssuedEmail({ orderNumber: 'MG-1', orderId: 'o1', amount: 80 })],
  ['sellerNewOrder', T.sellerNewOrderEmail({ orderNumber: 'MG-1', orderId: 'o1', items: ITEMS, totalAmount: 80 })],
  ['payout', T.payoutSentEmail({ amount: 68 })],
  ['listingApproved', T.listingApprovedEmail({ productTitle: 'Heels', productPath: '/products/heels' })],
  ['listingRejected', T.listingRejectedEmail({ productTitle: 'Heels' })],
  ['offerReceived', T.offerReceivedEmail({ productTitle: 'Heels', amount: 70, offerPath: '/p/o' })],
  ['offerAccepted', T.offerAcceptedEmail({ productTitle: 'Heels', amount: 70, productPath: '/p' })],
  ['offerDeclined', T.offerDeclinedEmail({ productTitle: 'Heels', productPath: '/p' })],
  ['newMessage', T.newMessageEmail({ senderName: 'Elira', conversationId: 'c1' })],
  ['returnRequested', T.returnRequestedEmail({ orderNumber: 'MG-1', orderId: 'o1' })],
  ['returnResolved', T.returnResolvedEmail({ orderNumber: 'MG-1', orderId: 'o1', outcome: 'Refunded' })],
];

describe('templates', () => {
  it.each(ALL)('%s renders a complete document', (_name, email) => {
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.category.length).toBeGreaterThan(0);
    expect(email.html).toContain('<html');
    expect(email.html).toContain('</html>');
  });

  // Relative URLs simply do not resolve in an email client.
  it.each(ALL)('%s has no relative links', (_name, email) => {
    const hrefs = [...email.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) {
      expect(h.startsWith('http') || h.startsWith('mailto:'), `relative href: ${h}`).toBe(true);
    }
  });

  it.each(ALL)('%s survives conversion to plain text', (_name, email) => {
    const text = htmlToText(email.html);
    expect(text.length).toBeGreaterThan(20);
    expect(text).not.toContain('<');
  });

  it('formats money to two decimals in EUR', () => {
    expect(T.money(80)).toBe('€80.00');
    expect(T.money(1.9324)).toBe('€1.93');
    expect(T.money(0)).toBe('€0.00');
    expect(T.money(NaN as unknown as number)).toBe('€0.00');
  });

  it('greets by first name only, and copes without one', () => {
    expect(T.welcomeEmail({ name: 'Elira Hoxha' }).html).toContain('Hi Elira,');
    expect(T.welcomeEmail({}).html).toContain('Hi,');
  });
});

describe('escaping', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  // Titles and reasons are user-supplied; unescaped they would inject markup
  // into an email that renders in someone else's client.
  it('escapes a hostile product title rather than emitting it raw', () => {
    const html = T.listingRejectedEmail({
      productTitle: '<img src=x onerror=alert(1)>',
      reason: '<b>bad</b>',
    }).html;
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>bad</b>');
    expect(html).toContain('&lt;img');
  });
});

describe('sendEmail', () => {
  const KEY = process.env.SENDGRID_API_KEY;
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => {
    if (KEY === undefined) delete process.env.SENDGRID_API_KEY;
    else process.env.SENDGRID_API_KEY = KEY;
  });

  it('skips quietly with no API key rather than throwing', async () => {
    delete process.env.SENDGRID_API_KEY;
    const res = await sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' });
    expect(res).toMatchObject({ ok: false, skipped: true });
  });

  it('skips when there is no recipient', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test';
    const res = await sendEmail({ to: '', subject: 's', html: '<p>x</p>' });
    expect(res).toMatchObject({ ok: false, skipped: true });
  });

  // A mail outage must not fail the checkout that triggered the receipt.
  it('returns a failure result instead of throwing when SendGrid errors', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test';
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('forbidden', { status: 403 }) as any,
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  it('does not throw when the network itself fails', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test';
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })).resolves.toMatchObject({ ok: false });
  });

  it('sends text before html, as the RFC requires', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test';
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 202 }) as any);
    await sendEmail({ to: 'a@b.com', subject: 's', html: '<p>hello</p>' });
    const body = JSON.parse((spy.mock.calls[0][1] as any).body);
    expect(body.content[0].type).toBe('text/plain');
    expect(body.content[1].type).toBe('text/html');
    expect(body.content[0].value).toContain('hello');
  });
});
