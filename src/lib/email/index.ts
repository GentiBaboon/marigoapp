/**
 * Transactional email.
 *
 *   src/lib/email/client.ts     SendGrid transport (v3 REST, no SDK)
 *   src/lib/email/layout.ts     shared branded shell
 *   src/lib/email/templates.ts  one function per event
 *
 * Every sender here is **fire-and-forget by contract**: it resolves with a
 * result rather than throwing, so a mail outage can never fail the checkout,
 * publish or refund that triggered it. Callers should not await them on the
 * critical path.
 *
 * Replaces src/lib/mailtrap.ts, whose sender was the shared
 * `hello@demomailtrap.co` sandbox address — mail from it never reaches a real
 * inbox.
 */
import { sendEmail, type SendResult } from './client';
import * as T from './templates';

export type { SendResult };
export { sendEmail } from './client';
export * as templates from './templates';

/** Dispatch a rendered template to one recipient. */
async function deliver(to: string, rendered: T.RenderedEmail, replyTo?: string): Promise<SendResult> {
  return sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    category: rendered.category,
    replyTo,
  });
}

// ─── Account ──────────────────────────────────────────────────────────────────

export const sendWelcomeEmail = (to: string, a: { name?: string }) =>
  deliver(to, T.welcomeEmail(a));

export const sendPasswordResetMail = ({
  to, email, name, resetLink,
}: { to?: string; email?: string; name?: string; resetLink: string }) =>
  // `email` is accepted as well as `to` because the previous Mailtrap helper
  // took that name and /api/forgot-password still calls it that way.
  deliver((to || email) as string, T.passwordResetEmail({ name, resetLink }));

export const sendEmailVerification = (to: string, a: { name?: string; verifyLink: string }) =>
  deliver(to, T.emailVerificationEmail(a));

/**
 * The 6-digit activation code.
 *
 * The one sender callers *should* await. Every other function in this file is
 * fire-and-forget because losing a receipt is not losing an order — but the
 * user is sitting in front of a code entry box waiting for this one, so
 * `/api/auth/send-otp` reports the delivery result rather than assuming it.
 */
export const sendEmailOtp = (to: string, a: { name?: string; code: string; expiresMinutes: number }) =>
  deliver(to, T.emailOtpEmail(a));

// ─── Orders — buyer ───────────────────────────────────────────────────────────

/**
 * Kept on the original signature so `/api/create-order` and
 * `/api/create-payment-intent` did not need touching beyond the import.
 */
export const sendOrderConfirmation = (a: {
  buyerEmail: string;
  buyerName?: string;
  orderNumber: string;
  orderId: string;
  items: T.OrderItem[];
  subtotal?: number;
  shipping?: number;
  totalAmount: number;
  paymentMethod?: 'cod' | 'card';
  shippingAddress?: { fullName: string; address: string; city: string; postal: string; country: string };
}) => deliver(a.buyerEmail, T.orderConfirmationEmail(a));

export const sendOrderShipped = (a: {
  buyerEmail: string; buyerName?: string; orderNumber: string; orderId: string; courier?: string; trackingCode?: string;
}) => deliver(a.buyerEmail, T.orderShippedEmail(a));

export const sendOrderDelivered = (a: {
  buyerEmail: string; buyerName?: string; orderNumber: string; orderId: string; inspectionDays?: number;
}) => deliver(a.buyerEmail, T.orderDeliveredEmail(a));

export const sendOrderCancelled = (a: {
  buyerEmail: string; buyerName?: string; orderNumber: string; orderId: string; reason?: string; paymentMethod?: 'cod' | 'card';
}) => deliver(a.buyerEmail, T.orderCancelledEmail(a));

export const sendRefundIssued = (a: {
  buyerEmail: string; buyerName?: string; orderNumber: string; orderId: string; amount: number;
}) => deliver(a.buyerEmail, T.refundIssuedEmail(a));

// ─── Orders — seller ──────────────────────────────────────────────────────────

export const sendSellerOrderNotification = (a: {
  sellerEmail: string; sellerName?: string; orderNumber: string; orderId: string; items: T.OrderItem[]; totalAmount: number;
}) => deliver(a.sellerEmail, T.sellerNewOrderEmail(a));

export const sendPayoutSent = (a: {
  sellerEmail: string; sellerName?: string; amount: number; orderNumber?: string;
}) => deliver(a.sellerEmail, T.payoutSentEmail(a));

// ─── Listings ─────────────────────────────────────────────────────────────────

export const sendListingApproved = (a: {
  sellerEmail: string; sellerName?: string; productTitle: string; productPath: string;
}) => deliver(a.sellerEmail, T.listingApprovedEmail(a));

export const sendListingRejected = (a: {
  sellerEmail: string; sellerName?: string; productTitle: string; reason?: string;
}) => deliver(a.sellerEmail, T.listingRejectedEmail(a));

// ─── Offers ───────────────────────────────────────────────────────────────────

export const sendOfferReceived = (a: {
  sellerEmail: string; sellerName?: string; buyerName?: string; productTitle: string; amount: number; offerPath: string;
}) => deliver(a.sellerEmail, T.offerReceivedEmail(a));

export const sendOfferAccepted = (a: {
  buyerEmail: string; buyerName?: string; productTitle: string; amount: number; productPath: string;
}) => deliver(a.buyerEmail, T.offerAcceptedEmail(a));

export const sendOfferDeclined = (a: {
  buyerEmail: string; buyerName?: string; productTitle: string; productPath: string;
}) => deliver(a.buyerEmail, T.offerDeclinedEmail(a));

// ─── Messages ─────────────────────────────────────────────────────────────────

export const sendMessageNotification = (a: {
  recipientEmail: string; recipientName?: string; senderName: string; productTitle?: string; preview?: string; conversationId: string;
}) => deliver(a.recipientEmail, T.newMessageEmail(a));

// ─── Returns ──────────────────────────────────────────────────────────────────

export const sendReturnRequested = (a: {
  sellerEmail: string; sellerName?: string; orderNumber: string; orderId: string; reason?: string;
}) => deliver(a.sellerEmail, T.returnRequestedEmail(a));

export const sendReturnResolved = (a: {
  to: string; name?: string; orderNumber: string; orderId: string; outcome: string;
}) => deliver(a.to, T.returnResolvedEmail(a));

// ─── Admin alerts ─────────────────────────────────────────────────────────────

/**
 * Where operational mail goes. Overridable per deployment so a staging
 * environment does not page the live inbox, but it must never fall back to
 * `SENDGRID_FROM_EMAIL` — that is a no-reply mailbox nobody reads.
 */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'hello@marigoapp.com';

/** Every admin alert is fire-and-forget, exactly like the customer senders:
 *  an order must never fail because the platform inbox was unreachable. */
export const sendAdminNewUser = (a: {
  name?: string; email?: string; userId: string; provider?: string; role?: string; totalUsers?: number;
}) => deliver(ADMIN_EMAIL, T.adminNewUserEmail(a));

export const sendAdminNewOrder = (a: {
  orderNumber: string;
  orderId: string;
  buyerName?: string;
  buyerEmail?: string;
  items: T.OrderItem[];
  subtotal?: number;
  shipping?: number;
  totalAmount: number;
  paymentMethod?: 'cod' | 'card';
  sellerCount?: number;
  shippingAddress?: { fullName: string; address: string; city: string; postal: string; country: string };
}) => deliver(ADMIN_EMAIL, T.adminNewOrderEmail(a));

export const sendAdminOrderCancelled = (a: {
  orderNumber: string;
  orderId: string;
  buyerName?: string;
  buyerEmail?: string;
  totalAmount?: number;
  reason?: string;
  cancelledBy?: string;
  previousStatus?: string;
}) => deliver(ADMIN_EMAIL, T.adminOrderCancelledEmail(a));
