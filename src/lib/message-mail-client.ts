'use client';

import type { User } from 'firebase/auth';

/**
 * Ask the server to email the other party about a message just written.
 *
 * Every path that writes a chat message calls this **after** its Firestore
 * writes: the normal chat input, the admin's "Message seller" panel on a
 * listing, and the dispute console. The route (`/api/messages/notify`)
 * re-reads the conversation under the caller's token and mails only when
 * the message is the recipient's first unread one.
 *
 * Fire-and-forget by contract. The SendGrid key lives server-side, and a
 * failed email must never fail — or even delay — the message itself. The
 * admin panel used to write its own bell notification and stop there, which
 * is how a seller could be "notified" with nothing reaching their inbox.
 */
export function requestMessageEmail(user: User | null | undefined, conversationId: string): void {
  if (!user || !conversationId) return;
  user
    .getIdToken()
    .then((token) =>
      fetch('/api/messages/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId }),
      }),
    )
    .catch((err) => console.warn('[messages] notify failed:', err));
}
