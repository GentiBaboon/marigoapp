'use client';

import { useEffect, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { useAppRouter } from '@/lib/platform/use-app-router';
import { IS_NATIVE_BUILD, isNativeApp } from '@/lib/platform/native';
import { registerForPush, type PushRegistration } from '@/lib/push/register';

/**
 * Registers this device for push once someone is signed in. Renders nothing.
 *
 * Mounted from the root layout so it survives navigation — registering per page
 * would re-attach the plugin listeners on every route change, and a tapped
 * notification would then be handled as many times as the app had navigated.
 *
 * Registration follows the account rather than the launch: the token is stored
 * under `users/{uid}/pushTokens`, so signing out has to withdraw it or a shared
 * phone keeps delivering the previous member's orders to whoever holds it.
 */
export function PushRegistrar() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useAppRouter();

  // Held in a ref rather than state: nothing renders from it, and putting it in
  // state would re-run the effect that created it.
  const active = useRef<PushRegistration | null>(null);
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!IS_NATIVE_BUILD || !isNativeApp() || !firestore) return;

    const uid = user?.uid ?? null;
    if (registeredFor.current === uid) return;

    let cancelled = false;

    // Tear down whatever the previous account left behind before touching the
    // new one, so the two never both hold listeners.
    const previous = active.current;
    active.current = null;
    registeredFor.current = uid;

    const cleanup = async () => {
      if (!previous) return;
      await previous.forget();
      await previous.teardown();
    };

    cleanup()
      .then(() => {
        if (cancelled || !uid) return;
        return registerForPush({
          firestore,
          userId: uid,
          onOpen: (link) => router.push(link),
        }).then((registration) => {
          if (cancelled) {
            registration?.teardown();
            return;
          }
          active.current = registration;
        });
      })
      .catch(() => {
        // registerForPush already reports; a failure here must never surface
        // as an unhandled rejection during sign-in.
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, firestore, router]);

  return null;
}
