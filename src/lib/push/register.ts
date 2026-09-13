'use client';

/**
 * @fileOverview Device push registration for the iOS and Android shells.
 *
 * Registration is deliberately tied to a signed-in account: a token with no
 * user behind it cannot be addressed, and the notifications this app sends —
 * order status, offers, messages — are all personal. The whole module no-ops on
 * web, where `@capacitor/push-notifications` does not exist.
 *
 * Delivery is FCM on both platforms. Android gets an FCM token straight from
 * the plugin; iOS exchanges its APNs token for one in `AppDelegate.swift`, so
 * by the time a token reaches here it is the same kind of string on both and
 * one `firebase-admin` call can address either.
 */

import { deleteDoc, doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { getPlatform, isNativeApp } from '@/lib/platform/native';
import { isStorablePushToken, PUSH_TOKENS_COLLECTION } from '@/lib/push/tokens';
import { reportWarning } from '@/lib/error-reporter';

type PushModule = typeof import('@capacitor/push-notifications');

/** Loaded lazily so the plugin never lands in a web chunk. */
async function loadPlugin(): Promise<PushModule['PushNotifications'] | null> {
  if (!isNativeApp()) return null;
  try {
    const mod = await import('@capacitor/push-notifications');
    return mod.PushNotifications;
  } catch (error) {
    reportWarning('plugin unavailable', { source: 'push', extra: { error } });
    return null;
  }
}

/** Persists one device's token under the owner's account. */
async function saveToken(firestore: Firestore, userId: string, token: string) {
  if (!isStorablePushToken(token)) {
    reportWarning('refusing to store a malformed token', { source: 'push', userId });
    return;
  }
  await setDoc(
    doc(firestore, 'users', userId, PUSH_TOKENS_COLLECTION, token),
    {
      token,
      platform: getPlatform(),
      // Lets the sender retire tokens that have gone quiet for months, which
      // FCM otherwise only reveals by failing a send.
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export type PushRegistration = {
  /** Detaches the plugin listeners. Safe to call more than once. */
  teardown: () => Promise<void>;
  /**
   * Forgets this device for the account it was registered to.
   *
   * Called when the account signs out or a different one signs in. Without it a
   * shared phone keeps delivering the previous member's orders and messages to
   * whoever is holding it.
   */
  forget: () => Promise<void>;
};

/**
 * Asks for permission, registers with APNs/FCM and wires up the tap handler.
 *
 * Resolves to `null` on web, on a denied permission, or when the plugin is
 * missing — every one of which is a normal state rather than an error, so
 * nothing here throws at the caller.
 *
 * @param onOpen Handed the in-app path carried on a tapped notification.
 */
export async function registerForPush(args: {
  firestore: Firestore;
  userId: string;
  onOpen: (link: string) => void;
}): Promise<PushRegistration | null> {
  const { firestore, userId, onOpen } = args;
  const PushNotifications = await loadPlugin();
  if (!PushNotifications) return null;

  let currentToken: string | null = null;

  try {
    // `requestPermissions` shows the system prompt the first time and resolves
    // from the stored answer afterwards, so checking first is what keeps a
    // previously-denied device from being asked on every launch — iOS ignores
    // the second request anyway, but Android 13+ does re-prompt.
    let status = await PushNotifications.checkPermissions();
    if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
      status = await PushNotifications.requestPermissions();
    }
    if (status.receive !== 'granted') return null;

    const registration = await PushNotifications.addListener('registration', (token) => {
      currentToken = token.value;
      saveToken(firestore, userId, token.value).catch((error) => {
        reportWarning('could not store the device token', { source: 'push', userId, extra: { error } });
      });
    });

    const registrationError = await PushNotifications.addListener('registrationError', (error) => {
      // Routine on a simulator, which has no APNs connection. Reported rather
      // than thrown so it never interrupts a sign-in.
      reportWarning('registration failed', { source: 'push', userId, extra: { error } });
    });

    // Fired when the person taps the notification, whether the app was running
    // or cold. `data.link` is the in-app path written by `notifyUser`.
    const opened = await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        const link = action.notification?.data?.link;
        if (typeof link === 'string' && link.startsWith('/')) onOpen(link);
      },
    );

    await PushNotifications.register();

    return {
      teardown: async () => {
        await Promise.all([
          registration.remove(),
          registrationError.remove(),
          opened.remove(),
        ]).catch(() => undefined);
      },
      forget: async () => {
        if (!currentToken || !isStorablePushToken(currentToken)) return;
        await deleteDoc(doc(firestore, 'users', userId, PUSH_TOKENS_COLLECTION, currentToken)).catch(
          () => undefined,
        );
      },
    };
  } catch (error) {
    reportWarning('could not register this device', { source: 'push', userId, extra: { error } });
    return null;
  }
}
