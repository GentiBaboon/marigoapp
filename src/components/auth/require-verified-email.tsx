'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';
import { useEmailVerification } from '@/hooks/use-email-verification';
import { needsVerifiedEmail, verifyEmailHref } from '@/lib/account-verification';

/**
 * Sends an unconfirmed account to the code screen before a gated page loads.
 *
 * Mounted once, in the root layout, so it covers every entry: a link, a typed
 * URL, a tab restored from yesterday. The list of gated paths and the
 * definition of "confirmed" both live in `src/lib/account-verification.ts`.
 *
 * This is the courteous layer, not the secure one. The API routes behind
 * these pages refuse an unverified caller on their own
 * (`src/lib/verified-account.ts`); this just turns the 403 they would get at
 * the end of a form into a clear screen at the start of it.
 *
 * Renders nothing. `router.replace`, not `push`, so Back does not return to
 * a page that would only bounce again.
 */
export function RequireVerifiedEmail() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useEmailVerification();

  const gated = needsVerifiedEmail(pathname ?? '');
  const bounce = gated && status === 'unverified';

  useEffect(() => {
    if (bounce) router.replace(verifyEmailHref(pathname));
  }, [bounce, pathname, router]);

  return null;
}
