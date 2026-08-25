/**
 * One function per event. Each returns a subject plus rendered HTML; the
 * transport derives the plain-text part.
 *
 * Money is formatted in EUR because that is the currency every amount is
 * *stored* in (see CLAUDE.md §9). The site displays ALL by converting at read
 * time, but an email is a record of a transaction — quoting a converted figure
 * would disagree with the Stripe receipt and the finance dashboard.
 */
import { absoluteUrl } from '@/lib/site';
import { renderEmail, button, detailRows, highlight, escapeHtml } from './layout';

export interface RenderedEmail {
  subject: string;
  html: string;
  category: string;
}

export function money(amount: number): string {
  return `€${(Number(amount) || 0).toFixed(2)}`;
}

function greeting(name?: string): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first ? `Hi ${escapeHtml(first)},` : 'Hi,';
}

function itemList(items: Array<{ brand?: string; title: string; price?: number }>): string {
  if (!items?.length) return '';
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:14px 0;">
    ${items
      .map(
        (i) => `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid #f0f0f0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#1a1a1a;">
        ${i.brand ? `<strong>${escapeHtml(i.brand)}</strong> — ` : ''}${escapeHtml(i.title)}
      </td>
      <td align="right" style="padding:11px 0;border-bottom:1px solid #f0f0f0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#1a1a1a;white-space:nowrap;">
        ${i.price != null ? money(i.price) : ''}
      </td>
    </tr>`,
      )
      .join('')}
  </table>`;
}

// ─── Account ──────────────────────────────────────────────────────────────────

export function welcomeEmail(a: { name?: string }): RenderedEmail {
  return {
    subject: 'Welcome to Marigo',
    category: 'welcome',
    html: renderEmail({
      heading: 'Welcome to Marigo',
      preheader: 'Authenticated pre-owned luxury, bought and sold safely.',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.name)}</p>
        <p style="margin:0 0 14px;">Marigo is a marketplace for authenticated pre-owned luxury fashion. Every listing is reviewed before it goes live, and every payment is held securely until your order is delivered.</p>
        ${button('Start browsing', absoluteUrl('/'))}
        <p style="margin:0;color:#6b7280;font-size:13px;">Got something to sell? Listing takes a few minutes — the assistant can even write it for you from your photos.</p>`,
    }),
  };
}

export function passwordResetEmail(a: { name?: string; resetLink: string }): RenderedEmail {
  return {
    subject: 'Reset your Marigo password',
    category: 'password-reset',
    html: renderEmail({
      heading: 'Reset your password',
      preheader: 'This link expires in one hour.',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.name)}</p>
        <p style="margin:0 0 14px;">Use the button below to choose a new password. The link expires in one hour.</p>
        ${button('Choose a new password', a.resetLink)}
        <p style="margin:0;color:#6b7280;font-size:13px;">If you did not ask for this, you can ignore this email — your password stays as it is.</p>`,
    }),
  };
}

export function emailVerificationEmail(a: { name?: string; verifyLink: string }): RenderedEmail {
  return {
    subject: 'Confirm your email address',
    category: 'verify-email',
    html: renderEmail({
      heading: 'Confirm your email',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.name)}</p>
        <p style="margin:0 0 14px;">One click and your account is ready.</p>
        ${button('Confirm email', a.verifyLink)}`,
    }),
  };
}

export function emailOtpEmail(a: {
  name?: string;
  code: string;
  expiresMinutes: number;
}): RenderedEmail {
  // Spaced into two groups of three. Nobody transcribes six unbroken digits
  // reliably, and the gap survives copy-paste because the input strips
  // non-digits before checking (see `normalizeOtp`).
  const spaced = `${a.code.slice(0, 3)} ${a.code.slice(3)}`;
  return {
    subject: `${a.code} is your Marigo verification code`,
    category: 'verify-email',
    html: renderEmail({
      heading: 'Confirm your email',
      // The code goes in the preheader too, so it is readable from the inbox
      // list and the phone lock screen without opening anything.
      preheader: `Your verification code is ${spaced}. It expires in ${a.expiresMinutes} minutes.`,
      body: `
        <p style="margin:0 0 14px;">${greeting(a.name)}</p>
        <p style="margin:0 0 14px;">Enter this code on the sign-up screen to activate your account.</p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0;">
          <tr>
            <td align="center" style="padding:20px 12px;background:#faf7ff;border:1px solid #B884F5;border-radius:10px;">
              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:34px;font-weight:700;letter-spacing:10px;color:#1a1a1a;line-height:1.2;">${escapeHtml(spaced)}</div>
              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#6b7280;margin-top:8px;">Expires in ${a.expiresMinutes} minutes</div>
            </td>
          </tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">If you did not create a Marigo account, ignore this email — nobody can use the code without it. Never share it with anyone, including someone claiming to be Marigo support.</p>`,
    }),
  };
}

// ─── Orders — buyer ───────────────────────────────────────────────────────────

export interface OrderItem { brand?: string; title: string; price: number }

export function orderConfirmationEmail(a: {
  buyerName?: string;
  orderNumber: string;
  orderId: string;
  items: OrderItem[];
  subtotal?: number;
  shipping?: number;
  totalAmount: number;
  paymentMethod?: 'cod' | 'card';
  shippingAddress?: { fullName: string; address: string; city: string; postal: string; country: string };
}): RenderedEmail {
  const addr = a.shippingAddress;
  return {
    subject: `Order confirmed — #${a.orderNumber}`,
    category: 'order-confirmation',
    html: renderEmail({
      heading: 'Your order is confirmed',
      preheader: `Order #${a.orderNumber} · ${money(a.totalAmount)}`,
      body: `
        <p style="margin:0 0 14px;">${greeting(a.buyerName)}</p>
        <p style="margin:0 0 6px;">Thank you — we have your order and the seller has been notified.</p>
        ${itemList(a.items)}
        ${detailRows([
          ...(a.subtotal != null ? ([['Subtotal', money(a.subtotal)]] as Array<[string, string]>) : []),
          ...(a.shipping != null ? ([['Delivery', a.shipping === 0 ? 'Free' : money(a.shipping)]] as Array<[string, string]>) : []),
          ['Total', money(a.totalAmount)],
          ['Payment', a.paymentMethod === 'cod' ? 'Cash on delivery' : 'Card'],
          ['Order', `#${a.orderNumber}`],
        ])}
        ${
          addr
            ? highlight(
                `<strong>Delivering to</strong><br/>${escapeHtml(addr.fullName)}<br/>${escapeHtml(addr.address)}<br/>${escapeHtml(addr.city)} ${escapeHtml(addr.postal)}<br/>${escapeHtml(addr.country)}`,
              )
            : ''
        }
        ${button('Track your order', absoluteUrl(`/profile/orders/${a.orderId}`))}
        <p style="margin:0;color:#6b7280;font-size:13px;">Your payment is held securely and only released to the seller after delivery.</p>`,
    }),
  };
}

export function orderShippedEmail(a: {
  buyerName?: string; orderNumber: string; orderId: string; courier?: string; trackingCode?: string;
}): RenderedEmail {
  return {
    subject: `On its way — order #${a.orderNumber}`,
    category: 'order-shipped',
    html: renderEmail({
      heading: 'Your order is on its way',
      preheader: `Order #${a.orderNumber} has left the seller.`,
      body: `
        <p style="margin:0 0 14px;">${greeting(a.buyerName)}</p>
        <p style="margin:0 0 6px;">Your order has been collected and is heading to you.</p>
        ${detailRows([
          ['Order', `#${a.orderNumber}`],
          ...(a.courier ? ([['Courier', a.courier]] as Array<[string, string]>) : []),
          ...(a.trackingCode ? ([['Tracking', a.trackingCode]] as Array<[string, string]>) : []),
        ])}
        ${button('Follow your delivery', absoluteUrl(`/profile/orders/${a.orderId}`))}`,
    }),
  };
}

export function orderDeliveredEmail(a: {
  buyerName?: string; orderNumber: string; orderId: string; inspectionDays?: number;
}): RenderedEmail {
  const days = a.inspectionDays ?? 3;
  return {
    subject: `Delivered — order #${a.orderNumber}`,
    category: 'order-delivered',
    html: renderEmail({
      heading: 'Your order has been delivered',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.buyerName)}</p>
        <p style="margin:0 0 6px;">Please check your item over.</p>
        ${highlight(`If anything is not as described, open a return within <strong>${days} days</strong> and we will step in before the seller is paid.`)}
        ${button('View order', absoluteUrl(`/profile/orders/${a.orderId}`))}`,
    }),
  };
}

export function orderCancelledEmail(a: {
  buyerName?: string; orderNumber: string; orderId: string; reason?: string;
}): RenderedEmail {
  return {
    subject: `Order #${a.orderNumber} cancelled`,
    category: 'order-cancelled',
    html: renderEmail({
      heading: 'Your order has been cancelled',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.buyerName)}</p>
        <p style="margin:0 0 6px;">Order <strong>#${escapeHtml(a.orderNumber)}</strong> has been cancelled${a.reason ? `: ${escapeHtml(a.reason)}` : '.'}</p>
        <p style="margin:0 0 6px;">Any amount authorised on your card is released — depending on your bank it can take a few working days to disappear from your statement.</p>
        ${button('View order', absoluteUrl(`/profile/orders/${a.orderId}`))}`,
    }),
  };
}

export function refundIssuedEmail(a: {
  buyerName?: string; orderNumber: string; orderId: string; amount: number;
}): RenderedEmail {
  return {
    subject: `Refund issued — order #${a.orderNumber}`,
    category: 'refund',
    html: renderEmail({
      heading: 'Your refund is on its way',
      preheader: `${money(a.amount)} refunded for order #${a.orderNumber}`,
      body: `
        <p style="margin:0 0 14px;">${greeting(a.buyerName)}</p>
        ${detailRows([['Refunded', money(a.amount)], ['Order', `#${a.orderNumber}`]])}
        <p style="margin:0 0 6px;">It goes back to your original payment method. Banks usually take 5–10 working days.</p>
        ${button('View order', absoluteUrl(`/profile/orders/${a.orderId}`))}`,
    }),
  };
}

// ─── Orders — seller ──────────────────────────────────────────────────────────

export function sellerNewOrderEmail(a: {
  sellerName?: string; orderNumber: string; orderId: string; items: OrderItem[]; totalAmount: number;
}): RenderedEmail {
  return {
    subject: `You made a sale — order #${a.orderNumber}`,
    category: 'seller-new-order',
    html: renderEmail({
      heading: 'You made a sale',
      preheader: `Order #${a.orderNumber} · ${money(a.totalAmount)}`,
      body: `
        <p style="margin:0 0 14px;">${greeting(a.sellerName)}</p>
        <p style="margin:0 0 6px;">One of your listings just sold. Please get it ready — a courier will collect it.</p>
        ${itemList(a.items)}
        ${detailRows([['Order total', money(a.totalAmount)], ['Order', `#${a.orderNumber}`]])}
        ${button('Prepare the order', absoluteUrl(`/profile/listings/sales/${a.orderId}`))}
        <p style="margin:0;color:#6b7280;font-size:13px;">Your earnings are released after the buyer receives the item.</p>`,
    }),
  };
}

export function payoutSentEmail(a: {
  sellerName?: string; amount: number; orderNumber?: string;
}): RenderedEmail {
  return {
    subject: `Payout sent — ${money(a.amount)}`,
    category: 'payout',
    html: renderEmail({
      heading: 'Your payout is on its way',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.sellerName)}</p>
        ${detailRows([
          ['Amount', money(a.amount)],
          ...(a.orderNumber ? ([['Order', `#${a.orderNumber}`]] as Array<[string, string]>) : []),
        ])}
        ${button('View earnings', absoluteUrl('/profile/earnings'))}`,
    }),
  };
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export function listingApprovedEmail(a: {
  sellerName?: string; productTitle: string; productPath: string;
}): RenderedEmail {
  return {
    subject: `"${a.productTitle}" is live`,
    category: 'listing-approved',
    html: renderEmail({
      heading: 'Your listing is live',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.sellerName)}</p>
        <p style="margin:0 0 6px;"><strong>${escapeHtml(a.productTitle)}</strong> passed review and is now visible to buyers.</p>
        ${button('View your listing', absoluteUrl(a.productPath))}`,
    }),
  };
}

export function listingRejectedEmail(a: {
  sellerName?: string; productTitle: string; reason?: string;
}): RenderedEmail {
  return {
    subject: `"${a.productTitle}" needs changes`,
    category: 'listing-rejected',
    html: renderEmail({
      heading: 'Your listing needs a change',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.sellerName)}</p>
        <p style="margin:0 0 6px;">We could not publish <strong>${escapeHtml(a.productTitle)}</strong> as it is.</p>
        ${a.reason ? highlight(escapeHtml(a.reason)) : ''}
        <p style="margin:0 0 6px;">Edit the listing and it goes straight back into review.</p>
        ${button('Edit listing', absoluteUrl('/profile/listings'))}`,
    }),
  };
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export function offerReceivedEmail(a: {
  sellerName?: string; buyerName?: string; productTitle: string; amount: number; offerPath: string;
}): RenderedEmail {
  return {
    subject: `New offer on "${a.productTitle}"`,
    category: 'offer-received',
    html: renderEmail({
      heading: 'You have a new offer',
      preheader: `${money(a.amount)} for ${a.productTitle}`,
      body: `
        <p style="margin:0 0 14px;">${greeting(a.sellerName)}</p>
        <p style="margin:0 0 6px;">${a.buyerName ? `${escapeHtml(a.buyerName)} has` : 'Someone has'} offered on <strong>${escapeHtml(a.productTitle)}</strong>.</p>
        ${detailRows([['Offer', money(a.amount)]])}
        ${button('Accept or decline', absoluteUrl(a.offerPath))}`,
    }),
  };
}

export function offerAcceptedEmail(a: {
  buyerName?: string; productTitle: string; amount: number; productPath: string;
}): RenderedEmail {
  return {
    subject: `Your offer on "${a.productTitle}" was accepted`,
    category: 'offer-accepted',
    html: renderEmail({
      heading: 'Your offer was accepted',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.buyerName)}</p>
        <p style="margin:0 0 6px;">The seller accepted ${money(a.amount)} for <strong>${escapeHtml(a.productTitle)}</strong>. It is yours if you check out — offers do not hold an item forever.</p>
        ${button('Complete your purchase', absoluteUrl(a.productPath))}`,
    }),
  };
}

export function offerDeclinedEmail(a: {
  buyerName?: string; productTitle: string; productPath: string;
}): RenderedEmail {
  return {
    subject: `Your offer on "${a.productTitle}" was declined`,
    category: 'offer-declined',
    html: renderEmail({
      heading: 'Your offer was declined',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.buyerName)}</p>
        <p style="margin:0 0 6px;">The seller passed on your offer for <strong>${escapeHtml(a.productTitle)}</strong>. You are welcome to try again.</p>
        ${button('View item', absoluteUrl(a.productPath))}`,
    }),
  };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function newMessageEmail(a: {
  recipientName?: string; senderName: string; productTitle?: string; preview?: string; conversationId: string;
}): RenderedEmail {
  return {
    subject: a.productTitle
      ? `New message from ${a.senderName} about ${a.productTitle}`
      : `New message from ${a.senderName}`,
    category: 'new-message',
    html: renderEmail({
      heading: `Message from ${escapeHtml(a.senderName)}`,
      body: `
        <p style="margin:0 0 14px;">${greeting(a.recipientName)}</p>
        ${a.productTitle ? `<p style="margin:0 0 6px;">About <strong>${escapeHtml(a.productTitle)}</strong>:</p>` : ''}
        ${a.preview ? highlight(escapeHtml(a.preview)) : ''}
        ${button('Reply', absoluteUrl(`/messages/${a.conversationId}`))}`,
    }),
  };
}

// ─── Returns & disputes ───────────────────────────────────────────────────────

export function returnRequestedEmail(a: {
  sellerName?: string; orderNumber: string; orderId: string; reason?: string;
}): RenderedEmail {
  return {
    subject: `Return requested — order #${a.orderNumber}`,
    category: 'return-requested',
    html: renderEmail({
      heading: 'A buyer opened a return',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.sellerName)}</p>
        <p style="margin:0 0 6px;">A return was opened on order <strong>#${escapeHtml(a.orderNumber)}</strong>.</p>
        ${a.reason ? highlight(escapeHtml(a.reason)) : ''}
        ${button('Review the return', absoluteUrl(`/profile/listings/sales/${a.orderId}`))}`,
    }),
  };
}

export function returnResolvedEmail(a: {
  name?: string; orderNumber: string; orderId: string; outcome: string;
}): RenderedEmail {
  return {
    subject: `Return resolved — order #${a.orderNumber}`,
    category: 'return-resolved',
    html: renderEmail({
      heading: 'Your return has been resolved',
      body: `
        <p style="margin:0 0 14px;">${greeting(a.name)}</p>
        ${detailRows([['Order', `#${a.orderNumber}`], ['Outcome', a.outcome]])}
        ${button('View order', absoluteUrl(`/profile/orders/${a.orderId}`))}`,
    }),
  };
}

// ─── Admin alerts ─────────────────────────────────────────────────────────────
//
// Operational mail, sent to the platform inbox rather than to a customer, so
// the tone is a report and not a greeting. They reuse the same table-based
// shell — an admin reads mail in the same clients everyone else does — but the
// subject is prefixed "[Admin]" so an inbox rule can file the lot, and every
// button lands in /admin rather than on the storefront.

/** Subjects share a prefix so they can be filtered as one stream. */
function adminSubject(rest: string): string {
  return `[Admin] ${rest}`;
}

export function adminNewUserEmail(a: {
  name?: string;
  email?: string;
  userId: string;
  provider?: string;
  role?: string;
  totalUsers?: number;
}): RenderedEmail {
  return {
    subject: adminSubject(`New sign-up — ${a.name?.trim() || a.email || a.userId}`),
    category: 'admin-new-user',
    html: renderEmail({
      heading: 'A new user registered',
      preheader: `${a.name?.trim() || a.email || 'Someone'} just created an account.`,
      body: `
        <p style="margin:0 0 6px;">A new account has been created on Marigo.</p>
        ${detailRows([
          ['Name', a.name?.trim() || '—'],
          ['Email', a.email || '—'],
          ['Signed up with', a.provider || 'Email'],
          ['Role', a.role || 'buyer'],
          ...(a.totalUsers != null ? ([['Total users', String(a.totalUsers)]] as Array<[string, string]>) : []),
          ['User ID', a.userId],
        ])}
        ${button('Open in admin', absoluteUrl('/admin/users'))}`,
    }),
  };
}

export function adminNewOrderEmail(a: {
  orderNumber: string;
  orderId: string;
  buyerName?: string;
  buyerEmail?: string;
  items: OrderItem[];
  subtotal?: number;
  shipping?: number;
  totalAmount: number;
  paymentMethod?: 'cod' | 'card';
  sellerCount?: number;
  shippingAddress?: { fullName: string; address: string; city: string; postal: string; country: string };
}): RenderedEmail {
  const addr = a.shippingAddress;
  return {
    subject: adminSubject(`New order #${a.orderNumber} — ${money(a.totalAmount)}`),
    category: 'admin-new-order',
    html: renderEmail({
      heading: `New order #${escapeHtml(a.orderNumber)}`,
      preheader: `${money(a.totalAmount)} · ${a.items?.length ?? 0} item(s) · ${a.paymentMethod === 'cod' ? 'Cash on delivery' : 'Card'}`,
      body: `
        <p style="margin:0 0 6px;">An order has just been placed.</p>
        ${itemList(a.items)}
        ${detailRows([
          ...(a.subtotal != null ? ([['Subtotal', money(a.subtotal)]] as Array<[string, string]>) : []),
          ...(a.shipping != null ? ([['Delivery', a.shipping === 0 ? 'Free' : money(a.shipping)]] as Array<[string, string]>) : []),
          ['Total', money(a.totalAmount)],
          ['Payment', a.paymentMethod === 'cod' ? 'Cash on delivery' : 'Card'],
          ...(a.sellerCount != null ? ([['Sellers involved', String(a.sellerCount)]] as Array<[string, string]>) : []),
          ['Buyer', a.buyerName?.trim() || '—'],
          ...(a.buyerEmail ? ([['Buyer email', a.buyerEmail]] as Array<[string, string]>) : []),
        ])}
        ${
          addr
            ? highlight(
                `<strong>Delivering to</strong><br/>${escapeHtml(addr.fullName)}<br/>${escapeHtml(addr.address)}<br/>${escapeHtml(addr.city)} ${escapeHtml(addr.postal)}<br/>${escapeHtml(addr.country)}`,
              )
            : ''
        }
        ${button('Open in admin', absoluteUrl(`/admin/orders/${a.orderId}`))}
        ${
          a.paymentMethod === 'cod'
            ? `<p style="margin:0;color:#6b7280;font-size:13px;">Cash on delivery — no card was authorised, so there is nothing to capture.</p>`
            : `<p style="margin:0;color:#6b7280;font-size:13px;">The card is authorised only. Funds are captured after delivery plus the payout hold.</p>`
        }`,
    }),
  };
}

export function adminOrderCancelledEmail(a: {
  orderNumber: string;
  orderId: string;
  buyerName?: string;
  buyerEmail?: string;
  totalAmount?: number;
  reason?: string;
  cancelledBy?: string;
  previousStatus?: string;
}): RenderedEmail {
  return {
    subject: adminSubject(`Order #${a.orderNumber} cancelled`),
    category: 'admin-order-cancelled',
    html: renderEmail({
      heading: `Order #${escapeHtml(a.orderNumber)} was cancelled`,
      preheader: `${a.totalAmount != null ? `${money(a.totalAmount)} · ` : ''}cancelled by ${a.cancelledBy || 'an admin'}`,
      body: `
        <p style="margin:0 0 6px;">This order has been cancelled and its stock released back to the listings.</p>
        ${detailRows([
          ['Order', `#${a.orderNumber}`],
          ...(a.totalAmount != null ? ([['Value', money(a.totalAmount)]] as Array<[string, string]>) : []),
          ...(a.previousStatus ? ([['Previous status', a.previousStatus]] as Array<[string, string]>) : []),
          ['Cancelled by', a.cancelledBy || 'Admin'],
          ['Buyer', a.buyerName?.trim() || '—'],
          ...(a.buyerEmail ? ([['Buyer email', a.buyerEmail]] as Array<[string, string]>) : []),
        ])}
        ${a.reason ? highlight(`<strong>Reason</strong><br/>${escapeHtml(a.reason)}`) : ''}
        ${button('Open in admin', absoluteUrl(`/admin/orders/${a.orderId}`))}
        <p style="margin:0;color:#6b7280;font-size:13px;">If the card was authorised, check that the authorisation has been released.</p>`,
    }),
  };
}
