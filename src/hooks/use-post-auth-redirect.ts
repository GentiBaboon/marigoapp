'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';

import { useUser } from '@/firebase';

/**
 * Where to send someone once they're authenticated.
 *
 * The edge middleware bounces protected routes to `/auth/login?redirect=...`,
 * while links inside the app use `?next=...`. Reading only one of them silently
 * dropped the destination and dumped everyone on /home, so accept both.
 *
 * Only same-origin paths are honoured — a bare "/" prefix check would still let
 * "//evil.com" through as a protocol-relative URL.
 *
 * The destination is frequently a dynamic route — someone bounced off
 * /products/abc lands back on it after signing in — so every consumer must push
 * it through `useAppRouter`, which rewrites the path for the native bundle. A
 * plain `next/navigation` router sends the untranslated path and the app opens
 * on a blank screen, because a static export has no page at /products/abc.
 */
export function usePostAuthRedirect(): string {
  const searchParams = useSearchParams();
  const raw = searchParams.get('redirect') ?? searchParams.get('next');
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/home';
}

/**
 * Moves an already-signed-in visitor off the auth screens.
 *
 * The middleware's gate is a cookie-presence check, and the cookie can be
 * missing for a session that is perfectly valid client-side (it isn't sent on
 * cross-site arrivals, and it expires before the Firebase session does). Without
 * this, such a visitor is shown a sign-in form while the header displays their
 * avatar — logged in, but told to log in.
 *
 * `enabled` exists for the one screen where being signed in is *not* the end
 * of the story: sign-up creates the Firebase account first and only then asks
 * for the emailed activation code. Without a way to switch this off, the new
 * account's auth state would bounce the user into the app the instant it
 * appeared, and the code entry box would never be seen. Callers pass `false`
 * from the moment they begin creating an account until verification finishes.
 */
export function useRedirectIfSignedIn(enabled = true): boolean {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const target = usePostAuthRedirect();

  const shouldRedirect = enabled && !isUserLoading && !!user;

  React.useEffect(() => {
    if (shouldRedirect) router.replace(target);
  }, [shouldRedirect, router, target]);

  return shouldRedirect;
}
