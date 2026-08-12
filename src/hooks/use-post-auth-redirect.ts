'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
 */
export function useRedirectIfSignedIn(): boolean {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const target = usePostAuthRedirect();

  const shouldRedirect = !isUserLoading && !!user;

  React.useEffect(() => {
    if (shouldRedirect) router.replace(target);
  }, [shouldRedirect, router, target]);

  return shouldRedirect;
}
