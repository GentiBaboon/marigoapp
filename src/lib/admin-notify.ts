'use client';

/**
 * Client half of the admin alerts. The browser asks the server to send; the
 * server re-reads the record under the caller's token rather than trusting
 * anything passed here.
 *
 * Fire-and-forget by contract — a registration or a cancellation must never
 * fail because the platform inbox was unreachable.
 */
export type AdminNotifyEvent = 'user_registered' | 'order_cancelled';

export async function notifyAdmin(
  user: { getIdToken: () => Promise<string> } | null | undefined,
  body: { event: AdminNotifyEvent; orderId?: string; previousStatus?: string; reason?: string },
): Promise<void> {
  if (!user) return;
  try {
    const token = await user.getIdToken();
    await fetch('/api/admin/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[admin-notify] failed:', err);
  }
}
