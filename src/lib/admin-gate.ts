/**
 * The masked door in front of `/admin`.
 *
 * Visiting a secret path once per device mints an httpOnly cookie; `/admin/*`
 * answers **404** to anyone without it. The point is not to replace
 * authentication — `useAdminAuth`, the role table and the Firestore rules are
 * still the things that actually stop an attacker. The point is that a panel
 * nobody can find is a panel nobody probes: essentially all attack traffic
 * against `/admin` is automated scanners walking a wordlist, and they cannot
 * follow a door they never see.
 *
 * **404, never 403.** A 403 confirms an admin panel is there and worth
 * attacking; a 404 is indistinguishable from a typo. Same reason the gate is
 * checked before the auth redirect: bouncing to `/auth/login?redirect=/admin`
 * would announce the route just as loudly.
 *
 * ## Why a signed cookie and not a path prefix
 *
 * Renaming the route to `/{secret}` means the client router has to know the
 * secret, which puts it in the JS bundle for anyone to grep — masking that
 * survives exactly one `view-source`. Here the secret is a **server-only**
 * env var that never reaches the browser, and the 25 existing `/admin` links
 * keep working untouched.
 *
 * The cookie is a stateless HMAC rather than a session id because there is no
 * server-side session store on Vercel to look one up in.
 *
 * Edge-compatible on purpose: middleware runs on the Edge runtime, so this
 * uses Web Crypto (`crypto.subtle`) and never `node:crypto`.
 */

export const ADMIN_GATE_COOKIE = '__mg_gate';

/** How long one unlock lasts. Generous because the cookie only buys
 *  *discovery* — a stolen one still faces the whole auth stack behind it —
 *  and re-unlocking is a URL an admin has to go and find. */
export const ADMIN_GATE_TTL_DAYS = 30;

const PREFIX = 'admin-gate';

/**
 * Is the gate switched on?
 *
 * Both env vars absent means the feature is simply off and `/admin` behaves
 * exactly as it did before — auth-gated, not hidden. Failing *open* here is
 * deliberate: failing closed on missing config would lock an operator out of
 * their own admin panel with no way back in that does not involve a deploy,
 * and "off" is not a regression, it is the status quo.
 */
export function isGateEnabled(env: { unlockPath?: string; secret?: string }): boolean {
  return Boolean(env.unlockPath && env.unlockPath.startsWith('/') && env.secret && env.secret.length >= 16);
}

/** Compare without leaking how much of the value was right. */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

/**
 * Mint a cookie value: `<expiry>.<hmac>`.
 *
 * The expiry is inside the MAC, not merely beside it — otherwise anyone
 * holding a valid cookie could edit the timestamp and keep it forever.
 */
export async function signGateCookie(secret: string, expiresAt: number): Promise<string> {
  return `${expiresAt}.${await hmac(secret, `${PREFIX}|${expiresAt}`)}`;
}

export async function verifyGateCookie(
  secret: string,
  value: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return false;
  const expiresAt = Number(value.slice(0, dot));
  const signature = value.slice(dot + 1);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  return safeEqual(signature, await hmac(secret, `${PREFIX}|${expiresAt}`));
}

/** Does this request path match the secret unlock path? Trailing slash and
 *  case are normalised, because an admin typing it by hand will get one of
 *  those wrong and a near-miss is indistinguishable from an attack otherwise. */
export function isUnlockPath(pathname: string, unlockPath: string): boolean {
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p).toLowerCase();
  return safeEqual(norm(pathname), norm(unlockPath));
}
