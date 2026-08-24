/**
 * Unsubscribe endpoint.
 *
 * Serves two callers with the same handler:
 *   1. the confirmation page (JSON body), and
 *   2. Gmail/Yahoo's one-click control, which POSTs
 *      `List-Unsubscribe=One-Click` as form data with no token in the body —
 *      RFC 8058 puts it in the URL instead.
 *
 * The address is never taken from the request. It is recovered from the signed
 * token, so a caller can only ever unsubscribe the address the token was
 * minted for.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import { forgotPasswordLimiter, applyRateLimit } from '@/lib/rate-limit';

const SENDGRID = 'https://api.sendgrid.com/v3';

/**
 * Record the opt-out with SendGrid.
 *
 * With a suppression group configured the opt-out is scoped to non-essential
 * mail; without one it falls back to the global list, which also stops
 * receipts. The fallback is the lesser evil — silently doing nothing would
 * make the link a lie — but the group is what should be configured.
 */
async function suppress(email: string): Promise<{ ok: boolean; scope: 'group' | 'global'; error?: string }> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return { ok: false, scope: 'global', error: 'email not configured' };

  const groupId = Number(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID || '');
  const scoped = Number.isFinite(groupId) && groupId > 0;

  const url = scoped
    ? `${SENDGRID}/asm/groups/${groupId}/suppressions`
    : `${SENDGRID}/asm/suppressions/global`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_emails: [email] }),
    });
    if (res.ok) return { ok: true, scope: scoped ? 'group' : 'global' };
    const detail = await res.text().catch(() => '');
    console.error(`[unsubscribe] SendGrid ${res.status}: ${detail.slice(0, 200)}`);
    return { ok: false, scope: scoped ? 'group' : 'global', error: `sendgrid ${res.status}` };
  } catch (err: any) {
    console.error('[unsubscribe] failed:', err?.message ?? err);
    return { ok: false, scope: scoped ? 'group' : 'global', error: 'network' };
  }
}

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, forgotPasswordLimiter);
  if (limited) return limited;

  // One-click puts the token in the query string; the confirmation page sends
  // it as JSON. Accept both rather than making the mail client's format win.
  let token = req.nextUrl.searchParams.get('u') || '';
  if (!token) {
    const body = await req.json().catch(() => null as any);
    token = String(body?.token || '');
  }

  const email = verifyUnsubscribeToken(token);
  if (!email) {
    return NextResponse.json({ ok: false, error: 'This unsubscribe link is not valid.' }, { status: 400 });
  }

  const result = await suppress(email);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: 'We could not record that just now. Please try again.' },
      { status: 502 },
    );
  }

  // Never echo the address back — the page already knows it, and reflecting it
  // would turn the endpoint into a way to confirm a guessed token.
  return NextResponse.json({ ok: true, scope: result.scope });
}
