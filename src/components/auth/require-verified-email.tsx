'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useEmailVerification } from '@/hooks/use-email-verification';
import { needsVerifiedEmail, SUSPENDED_MESSAGE, verifyEmailHref } from '@/lib/account-verification';

/**
 * Two jobs, mounted once in the root layout so they cover every entry: a
 * link, a typed URL, a tab restored from yesterday.
 *
 * **A banned account is signed out, wherever it is.** The rules refuse its
 * writes and `syncBanToAuth` disables its sign-in, but a session that was
 * open when the ban landed keeps a valid ID token for up to an hour and can
 * go on browsing as a member. This watches the document live and ends the
 * session the moment `status` flips, with the same notice sign-in gives.
 *
 * **An unconfirmed account is sent to the code screen** before a gated page
 * loads. The list of gated paths and the definition of "confirmed" live in
 * `src/lib/account-verification.ts`.
 *
 * Both are the courteous layer, not the secure one: the API routes refuse a
 * banned or unverified caller on their own (`src/lib/verified-account.ts`).
 *
 * Renders nothing. `router.replace`, not `push`, so Back does not return to
 * a page that would only bounce again.
 */
export function RequireVerifiedEmail() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const { status } = useEmailVerification();

  const banned = status === 'banned';
  const bounce = !banned && status === 'unverified' && needsVerifiedEmail(pathname ?? '');

  useEffect(() => {
    if (!banned) return;
    auth
      .signOut()
      .catch(() => undefined)
      .then(() => {
        toast({ variant: 'destructive', title: 'Account suspended', description: SUSPENDED_MESSAGE });
        router.replace('/auth/login');
      });
  }, [banned, auth, router, toast]);

  useEffect(() => {
    if (bounce) router.replace(verifyEmailHref(pathname));
  }, [bounce, pathname, router]);

  return null;
}
