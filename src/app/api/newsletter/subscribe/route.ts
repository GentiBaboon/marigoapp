/**
 * POST /api/newsletter/subscribe — the footer's Subscribe form.
 *
 * Anonymous by design: the footer is seen mostly by signed-out visitors. It
 * is protected the way the other cookie-authenticated mutations are — the
 * double-submit CSRF token from middleware (the form sends `x-csrf-token`)
 * and a per-IP rate limit — and it refuses throwaway domains, which would
 * only ever bounce and hurt the sending reputation.
 *
 * Body: `{ email }`. The address is stored in SendGrid Marketing Contacts
 * (`src/lib/newsletter.ts`); nothing is written to Firestore.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { newsletterLimiter, applyRateLimit } from '@/lib/rate-limit';
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from '@/lib/email-policy';
import { subscribeToNewsletter } from '@/lib/newsletter';

export const runtime = 'nodejs';

const BodySchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
});

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, newsletterLimiter);
  if (limited) return limited;

  let email: string;
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    email = parsed.data.email;
  } catch {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  if (isDisposableEmail(email)) {
    return NextResponse.json({ error: DISPOSABLE_EMAIL_MESSAGE, reason: 'email_blocked' }, { status: 403 });
  }

  const result = await subscribeToNewsletter(email);
  if (result.ok) {
    return NextResponse.json({ success: true });
  }

  // The visitor gets one honest sentence; the reason goes to the server log,
  // where the operator can see whether it is the key's permissions
  // (`forbidden`) or a missing key (`not_configured`).
  console.error(`[newsletter] subscribe failed: ${result.reason}${result.status ? ` (${result.status})` : ''}`);
  return NextResponse.json(
    { error: 'We could not save your subscription right now. Please try again later.' },
    { status: 503 },
  );
}
