/**
 * SendGrid transport.
 *
 * Talks to the v3 REST API with `fetch` rather than `@sendgrid/mail`. The SDK
 * would add a dependency for what is one POST, and CI builds with placeholder
 * env — anything constructing a client at module scope has broken this build
 * before (see CLAUDE.md §11). Nothing here runs until a send is attempted.
 *
 * Never throws. A failed email must not fail the checkout that triggered it —
 * every caller is fire-and-forget, and losing a receipt is not losing an order.
 */
import { SITE_NAME, absoluteUrl } from '@/lib/site';

const API = 'https://api.sendgrid.com/v3/mail/send';

/** Verified sender. Must match a Single Sender or authenticated domain in
 *  SendGrid, or every send returns 403. */
function sender() {
  return {
    email: process.env.SENDGRID_FROM_EMAIL || 'hello@marigoapp.com',
    name: process.env.SENDGRID_FROM_NAME || SITE_NAME,
  };
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Sent alongside the HTML: a message with no text
   *  part scores worse with spam filters and is unreadable in text-only
   *  clients. Derived from the HTML when omitted. */
  text?: string;
  replyTo?: string;
  /** SendGrid category, so sends can be filtered in their dashboard. */
  category?: string;
}

export interface SendResult {
  ok: boolean;
  status?: number;
  skipped?: boolean;
  error?: string;
}

/** Crude HTML → text fallback. Good enough for a receipt; templates that care
 *  supply their own `text`. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|tr|div|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&euro;/g, '€')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
}

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const key = process.env.SENDGRID_API_KEY;

  // No key configured — local dev, CI, a preview build. Skip quietly rather
  // than throwing: the same code path runs in environments that will never
  // have mail credentials.
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[email] skipped (no SENDGRID_API_KEY): "${payload.subject}" -> ${payload.to}`);
    }
    return { ok: false, skipped: true };
  }
  if (!payload.to) return { ok: false, skipped: true, error: 'no recipient' };

  const body = {
    personalizations: [{ to: [{ email: payload.to }] }],
    from: sender(),
    ...(payload.replyTo ? { reply_to: { email: payload.replyTo } } : {}),
    subject: payload.subject,
    content: [
      // Order matters to the RFC: the plain-text part must come first, or
      // some clients render the wrong alternative.
      { type: 'text/plain', value: payload.text || htmlToText(payload.html) },
      { type: 'text/html', value: payload.html },
    ],
    ...(payload.category ? { categories: [payload.category] } : {}),
    tracking_settings: {
      click_tracking: { enable: false },
      open_tracking: { enable: true },
    },
    // Lets a recipient unsubscribe from marketing without contacting support,
    // and is what keeps transactional mail out of the promotions tab.
    mail_settings: { bypass_list_management: { enable: false } },
  };

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) return { ok: true, status: res.status };

    // SendGrid returns the reason in the body; the status alone is rarely
    // enough to tell a bad key from an unverified sender.
    const detail = await res.text().catch(() => '');
    console.error(`[email] SendGrid ${res.status} for "${payload.subject}": ${detail.slice(0, 300)}`);
    return { ok: false, status: res.status, error: detail.slice(0, 300) };
  } catch (err: any) {
    console.error('[email] send failed:', err?.message ?? err);
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/** Absolute link for use inside an email — relative URLs do not work in mail. */
export const mailUrl = absoluteUrl;
