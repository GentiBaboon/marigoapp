import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as T from '@/lib/email/templates';
import { escapeHtml, UNSUBSCRIBE_PLACEHOLDER } from '@/lib/email/layout';
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
  ['adminNewUser', T.adminNewUserEmail({ name: 'Elira', email: 'e@x.com', userId: 'u1' })],
  ['adminNewOrder', T.adminNewOrderEmail({ orderNumber: 'MG-1', orderId: 'o1', items: ITEMS, totalAmount: 80 })],
  ['adminOrderCancelled', T.adminOrderCancelledEmail({ orderNumber: 'MG-1', orderId: 'o1' })],
];

describe('templates', () => {
  it.each(ALL)('%s renders a complete document', (_name, email) => {
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.category.length).toBeGreaterThan(0);
    expect(email.html).toContain('<html');
    expect(email.html).toContain('</html>');
  });

  // Relative URLs simply do not resolve in an email client. The unsubscribe
  // placeholder is the one permitted non-URL: it is per-recipient, so the
  // transport swaps in a signed absolute link at send time — which the
  // substitution test below then holds to the same standard.
  it.each(ALL)('%s has no relative links', (_name, email) => {
    const hrefs = [...email.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) {
      if (h === UNSUBSCRIBE_PLACEHOLDER) continue;
      expect(h.startsWith('http') || h.startsWith('mailto:'), `relative href: ${h}`).toBe(true);
    }
  });

  it.each(ALL)('%s has only absolute links once the placeholder is filled', (_name, email) => {
    const filled = email.html.split(UNSUBSCRIBE_PLACEHOLDER).join('https://www.marigoapp.com/unsubscribe?u=t');
    const hrefs = [...filled.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
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

describe('admin alerts', () => {
  // One inbox rule should be able to file every operational mail.
  it('prefixes every subject with [Admin]', () => {
    expect(T.adminNewUserEmail({ userId: 'u1' }).subject).toMatch(/^\[Admin\] /);
    expect(T.adminNewOrderEmail({ orderNumber: 'MG-1', orderId: 'o1', items: ITEMS, totalAmount: 80 }).subject).toMatch(/^\[Admin\] /);
    expect(T.adminOrderCancelledEmail({ orderNumber: 'MG-1', orderId: 'o1' }).subject).toMatch(/^\[Admin\] /);
  });

  it('gives each alert its own category so they can be filtered apart', () => {
    expect(T.adminNewUserEmail({ userId: 'u1' }).category).toBe('admin-new-user');
    expect(T.adminNewOrderEmail({ orderNumber: 'MG-1', orderId: 'o1', items: ITEMS, totalAmount: 80 }).category).toBe('admin-new-order');
    expect(T.adminOrderCancelledEmail({ orderNumber: 'MG-1', orderId: 'o1' }).category).toBe('admin-order-cancelled');
  });

  // An operator following a link wants the admin console, not the storefront.
  it('links into /admin, never the public site', () => {
    expect(T.adminNewUserEmail({ userId: 'u1' }).html).toContain('/admin/users');
    expect(T.adminNewOrderEmail({ orderNumber: 'MG-1', orderId: 'o1', items: ITEMS, totalAmount: 80 }).html).toContain('/admin/orders/o1');
    expect(T.adminOrderCancelledEmail({ orderNumber: 'MG-1', orderId: 'o1' }).html).toContain('/admin/orders/o1');
  });

  it('reports the amount and the payment method on a new order', () => {
    const html = T.adminNewOrderEmail({
      orderNumber: 'MG-1', orderId: 'o1', items: ITEMS, totalAmount: 96.93, paymentMethod: 'cod',
    }).html;
    expect(html).toContain('€96.93');
    expect(html).toContain('Cash on delivery');
  });

  // An admin must not read a card order as "the money is in".
  it('says a card order is authorised, not captured', () => {
    const html = T.adminNewOrderEmail({
      orderNumber: 'MG-1', orderId: 'o1', items: ITEMS, totalAmount: 80, paymentMethod: 'card',
    }).html;
    expect(html).toContain('authorised only');
  });

  it('carries who cancelled and why', () => {
    const html = T.adminOrderCancelledEmail({
      orderNumber: 'MG-1', orderId: 'o1', cancelledBy: 'Hello Marigo', reason: 'Seller could not ship',
    }).html;
    expect(html).toContain('Hello Marigo');
    expect(html).toContain('Seller could not ship');
  });

  // Reasons are typed by a human and land in someone else's inbox.
  it('escapes a hostile cancellation reason', () => {
    const html = T.adminOrderCancelledEmail({
      orderNumber: 'MG-1', orderId: 'o1', reason: '<img src=x onerror=alert(1)>',
    }).html;
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('copes with a user who has no name yet', () => {
    const email = T.adminNewUserEmail({ userId: 'uid_1', email: 'e@x.com' });
    expect(email.subject).toContain('e@x.com');
    expect(email.html).toContain('uid_1');
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
  const SAVED = {
    key: process.env.SENDGRID_API_KEY,
    from: process.env.SENDGRID_FROM_EMAIL,
    name: process.env.SENDGRID_FROM_NAME,
    replyTo: process.env.SENDGRID_REPLY_TO,
  };
  const restore = (k: string, v: string | undefined) => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => {
    restore('SENDGRID_API_KEY', SAVED.key);
    restore('SENDGRID_FROM_EMAIL', SAVED.from);
    restore('SENDGRID_FROM_NAME', SAVED.name);
    restore('SENDGRID_REPLY_TO', SAVED.replyTo);
  });

  /** The JSON body of the single fetch a send makes. */
  async function capture(payload: Parameters<typeof sendEmail>[0]) {
    process.env.SENDGRID_API_KEY = 'SG.test';
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 202 }) as any);
    await sendEmail(payload);
    return JSON.parse((spy.mock.calls[0][1] as any).body);
  }

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
    const body = await capture({ to: 'a@b.com', subject: 's', html: '<p>hello</p>' });
    expect(body.content[0].type).toBe('text/plain');
    expect(body.content[1].type).toBe('text/html');
    expect(body.content[0].value).toContain('hello');
  });

  // The From is what a recipient sees and what SendGrid checks against its
  // verified-sender list; getting it wrong 403s every send in the app.
  it('uses the configured sender', async () => {
    process.env.SENDGRID_FROM_EMAIL = 'no-reply@marigoapp.com';
    process.env.SENDGRID_FROM_NAME = 'Marigo Fashion Marketplace';
    const body = await capture({ to: 'a@b.com', subject: 's', html: '<p>x</p>' });
    expect(body.from).toEqual({ email: 'no-reply@marigoapp.com', name: 'Marigo Fashion Marketplace' });
  });

  it('falls back to the no-reply sender when the env is unset', async () => {
    delete process.env.SENDGRID_FROM_EMAIL;
    delete process.env.SENDGRID_FROM_NAME;
    const body = await capture({ to: 'a@b.com', subject: 's', html: '<p>x</p>' });
    expect(body.from.email).toBe('no-reply@marigoapp.com');
    expect(body.from.name).toBe('Marigo Fashion Marketplace');
  });

  // A no-reply From with no Reply-To sends customer replies into a void.
  it('always carries a reachable Reply-To', async () => {
    delete process.env.SENDGRID_REPLY_TO;
    const body = await capture({ to: 'a@b.com', subject: 's', html: '<p>x</p>' });
    expect(body.reply_to.email).toBe('hello@marigoapp.com');
    expect(body.reply_to.email).not.toBe(body.from.email);
  });

  it('lets a caller override the Reply-To', async () => {
    const body = await capture({ to: 'a@b.com', subject: 's', html: '<p>x</p>', replyTo: 'seller@x.com' });
    expect(body.reply_to.email).toBe('seller@x.com');
  });

  it('tags the send with its category so it can be traced in the Activity Feed', async () => {
    const body = await capture({ to: 'a@b.com', subject: 's', html: '<p>x</p>', category: 'welcome' });
    expect(body.categories).toEqual(['welcome']);
  });
});
