'use client';

/**
 * Client half of the welcome email for provider-verified accounts. The
 * browser only asks; the server takes the address from the token and refuses
 * anyone whose address is not vouched for (`/api/auth/welcome`).
 *
 * Fire-and-forget by contract — a first sign-in must never fail because the
 * mail could not go out.
 */
export async function requestWelcomeMail(
  user: { getIdToken: () => Promise<string> } | null | undefined,
): Promise<void> {
  if (!user) return;
  try {
    const token = await user.getIdToken();
    await fetch('/api/auth/welcome', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('[welcome] request failed:', err);
  }
}
