/**
 * Newsletter sign-ups.
 *
 * Subscribers live in **SendGrid Marketing Contacts**, not Firestore. The
 * footer form is used mostly by signed-out visitors, and with no
 * service-account key (CLAUDE.md §6) the server cannot write to Firestore on
 * an anonymous visitor's behalf without an open write rule — the same
 * unmetered-write problem that put live presence in Redis (§9b). SendGrid is
 * also where a newsletter would actually be sent from, so the list is kept
 * where it is used.
 *
 * `PUT /v3/marketing/contacts` is an upsert, so subscribing twice is
 * harmless. The key needs **Marketing → Contacts** access; a key without it
 * answers 403, which is reported as `forbidden` rather than swallowed so the
 * operator sees the fix. SendGrid imports contacts asynchronously — a new
 * address takes up to a few minutes to show in the dashboard.
 *
 * Nothing here runs at module scope — CI builds with placeholder env.
 */
import { normalizeEmail } from '@/lib/otp';

const CONTACTS_API = 'https://api.sendgrid.com/v3/marketing/contacts';

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'forbidden' | 'failed'; status?: number; error?: string };

/** Optional list to file the contact under (Marketing → Contacts → Lists).
 *  Without it the contact still lands in "All Contacts". */
export function newsletterListId(): string | undefined {
  const id = (process.env.SENDGRID_NEWSLETTER_LIST_ID || '').trim();
  return id || undefined;
}

export async function subscribeToNewsletter(rawEmail: string): Promise<SubscribeResult> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[newsletter] skipped (no SENDGRID_API_KEY): ${rawEmail}`);
    }
    return { ok: false, reason: 'not_configured' };
  }

  const email = normalizeEmail(rawEmail);
  const listId = newsletterListId();
  const body = {
    ...(listId ? { list_ids: [listId] } : {}),
    contacts: [{ email }],
  };

  try {
    const res = await fetch(CONTACTS_API, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // 202: queued for import — SendGrid processes contact upserts
    // asynchronously, so this is as much confirmation as the API gives.
    if (res.ok) return { ok: true };

    const detail = await res.text().catch(() => '');
    console.error(`[newsletter] SendGrid ${res.status}: ${detail.slice(0, 300)}`);
    return {
      ok: false,
      reason: res.status === 401 || res.status === 403 ? 'forbidden' : 'failed',
      status: res.status,
      error: detail.slice(0, 300),
    };
  } catch (err: any) {
    console.error('[newsletter] request failed:', err?.message ?? err);
    return { ok: false, reason: 'failed', error: String(err?.message ?? err) };
  }
}
