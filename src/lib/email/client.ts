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
import { absoluteUrl } from '@/lib/site';
import { UNSUBSCRIBE_PLACEHOLDER } from './layout';
import { unsubscribeUrl, isEssentialCategory } from './unsubscribe';

const API = 'https://api.sendgrid.com/v3/mail/send';

/** Verified sender. Must match a Single Sender or authenticated domain in
 *  SendGrid, or every send returns 403. */
function sender() {
  return {
    email: process.env.SENDGRID_FROM_EMAIL || 'no-reply@marigoapp.com',
    name: process.env.SENDGRID_FROM_NAME || 'Marigo Fashion Marketplace',
  };
}

/** Where a reply actually goes. The From address is a no-reply mailbox, so
 *  without this a customer hitting Reply writes into a void — and a From with
 *  no reachable Reply-To also reads as spam to some filters. */
function defaultReplyTo(): string | undefined {
  return process.env.SENDGRID_REPLY_TO || 'hello@marigoapp.com';
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

/**
 * Swap the shell's placeholder for a link signed for this recipient.
 *
 * Done here rather than in the templates because only the transport knows who
 * the mail is addressed to. Previews and tests render the placeholder as a
 * plain `/unsubscribe` link, which is inert but not broken.
 */
function withUnsubscribeLink(html: string, to: string): string {
  return html.split(UNSUBSCRIBE_PLACEHOLDER).join(unsubscribeUrl(to));
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

  // Substituted before the text part is derived, so the plain-text
  // alternative carries a working link too rather than the raw placeholder.
  const html = withUnsubscribeLink(payload.html, payload.to);
  const unsubUrl = unsubscribeUrl(payload.to);

  /**
   * Suppression group, when one is configured.
   *
   * This is what makes "unsubscribe" mean *non-essential mail only*: mail sent
   * with a group id is suppressed for anyone who opted out of that group,
   * while receipts and password resets — sent with no group — are unaffected.
   * Doing it the other way round (a global unsubscribe plus
   * `bypass_list_management` on the important mail) would also bypass bounce
   * and spam-report suppression, which is how a sending domain gets blocked.
   */
  const groupId = Number(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID || '');
  const useGroup = Number.isFinite(groupId) && groupId > 0 && !isEssentialCategory(payload.category);

  const body = {
    personalizations: [{ to: [{ email: payload.to }] }],
    from: sender(),
    ...((payload.replyTo ?? defaultReplyTo())
      ? { reply_to: { email: (payload.replyTo ?? defaultReplyTo()) as string } }
      : {}),
    subject: payload.subject,
    content: [
      // Order matters to the RFC: the plain-text part must come first, or
      // some clients render the wrong alternative.
      { type: 'text/plain', value: payload.text || htmlToText(html) },
      { type: 'text/html', value: html },
    ],
    /**
     * RFC 2369 + RFC 8058. Gmail and Outlook surface their own "Unsubscribe"
     * control beside the sender name when these are present, and a one-click
     * header is now effectively required by the bulk-sender rules at Gmail and
     * Yahoo. The mailto: is the fallback for clients that ignore the HTTPS one.
     */
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>, <mailto:${defaultReplyTo()}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    ...(useGroup ? { asm: { group_id: groupId } } : {}),
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
