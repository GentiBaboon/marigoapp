/**
 * Pre-flight for transactional email. Verifies the SendGrid account is in a
 * state that can actually deliver, *before* a real send proves it the hard way.
 *
 *   node scripts/check-email-config.mjs
 *   node scripts/check-email-config.mjs --to hello@marigoapp.com
 *
 * Checks, in the order failures actually bite:
 *   1. env vars present and well-formed
 *   2. the API key authenticates at all
 *   3. the key carries mail.send (a key without it returns 403 on every send)
 *   4. the From address is a verified Single Sender, or its domain is
 *      authenticated — the single most common cause of a silent 403
 *   5. the recipient is not on a bounce / block / spam / unsubscribe list,
 *      which makes SendGrid accept a send with 202 and then drop it
 *
 * Exits non-zero only on a hard failure. Checks the key lacks the scope to
 * perform are reported as "unknown", not as errors — a Mail-Send-restricted
 * key is the recommended setup and cannot read most of this.
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

if (existsSync(join(ROOT, '.env.local'))) {
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const argTo = process.argv.includes('--to') ? process.argv[process.argv.indexOf('--to') + 1] : null;

const KEY = process.env.SENDGRID_API_KEY || '';
const FROM = process.env.SENDGRID_FROM_EMAIL || 'no-reply@marigoapp.com';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Marigo Fashion Marketplace';
const REPLY_TO = process.env.SENDGRID_REPLY_TO || 'hello@marigoapp.com';
const TO = argTo || 'hello@marigoapp.com';

let failed = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const bad = (m) => { failed++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

async function api(path) {
  const res = await fetch(`https://api.sendgrid.com/v3${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  let body = null;
  try { body = await res.json(); } catch { /* empty body is fine */ }
  return { status: res.status, ok: res.ok, body };
}

console.log('\x1b[1mMarigo — SendGrid configuration check\x1b[0m');

// ── 1. Environment ──────────────────────────────────────────────────────────
head('1. Environment');
if (!KEY) {
  bad('SENDGRID_API_KEY is not set — add it to .env.local (and to Vercel)');
} else if (!KEY.startsWith('SG.')) {
  bad(`SENDGRID_API_KEY does not look like a SendGrid key (expected "SG." prefix, got "${KEY.slice(0, 3)}…")`);
} else {
  ok(`SENDGRID_API_KEY present (SG.…${KEY.slice(-4)})`);
}
ok(`From: ${FROM_NAME} <${FROM}>`);
ok(`Reply-To: ${REPLY_TO}`);
ok(`Test recipient: ${TO}`);
if (!process.env.SENDGRID_FROM_EMAIL) warn('SENDGRID_FROM_EMAIL unset — using the built-in default');

if (!KEY) {
  console.log('\nCannot continue without an API key.');
  process.exit(1);
}

// ── 2. Authentication ───────────────────────────────────────────────────────
head('2. API key');
const scopes = await api('/scopes');
if (scopes.status === 401) {
  bad('401 Unauthorized — the key is wrong, revoked, or from another account');
  process.exit(1);
} else if (!scopes.ok) {
  warn(`could not read scopes (HTTP ${scopes.status}) — continuing`);
} else {
  ok('key authenticates');
  const list = scopes.body?.scopes ?? [];
  if (list.includes('mail.send')) ok(`carries mail.send (${list.length} scopes total)`);
  else bad(`key does NOT carry mail.send — every send will 403. Scopes: ${list.join(', ') || 'none'}`);
  if (list.includes('_rw') || list.includes('user.email.read')) {
    warn('key looks like Full Access — a Mail Send-only key is safer for this app');
  }
}

// ── 3. Sender identity ──────────────────────────────────────────────────────
head('3. Sender identity');
const fromDomain = FROM.split('@')[1] ?? '';
let senderProven = false;

const verified = await api('/verified_senders');
if (verified.ok) {
  const results = verified.body?.results ?? [];
  const match = results.find((s) => (s.from_email || '').toLowerCase() === FROM.toLowerCase());
  if (match?.verified) { ok(`${FROM} is a verified Single Sender`); senderProven = true; }
  else if (match) bad(`${FROM} exists as a Single Sender but is NOT verified — confirm the email SendGrid sent to it`);
  else warn(`${FROM} is not in the Single Sender list (${results.length} entries) — checking domain authentication`);
} else {
  warn(`cannot read Single Senders (HTTP ${verified.status}) — restricted key, checking domain authentication`);
}

const domains = await api('/whitelabel/domains');
if (domains.ok) {
  const list = Array.isArray(domains.body) ? domains.body : [];
  const match = list.find((d) => fromDomain === d.domain || fromDomain.endsWith(`.${d.domain}`));
  if (match?.valid) {
    ok(`${fromDomain} is an authenticated domain (DKIM/SPF records valid) — no "via sendgrid.net" line`);
    senderProven = true;
  } else if (match) {
    bad(`${fromDomain} is set up for authentication but the DNS records are NOT valid yet — add the CNAMEs SendGrid lists, then hit Verify`);
  } else {
    warn(`${fromDomain} is not an authenticated domain (${list.length} configured)`);
  }
} else {
  warn(`cannot read domain authentication (HTTP ${domains.status}) — restricted key`);
}

if (!senderProven) {
  warn(`could not prove ${FROM} is a verified sender. If sends come back 403, this is why.`);
}

// ── 4. Recipient suppressions ───────────────────────────────────────────────
head('4. Recipient state');
const encoded = encodeURIComponent(TO);
const suppressions = [
  ['bounce', `/suppression/bounces/${encoded}`],
  ['block', `/suppression/blocks/${encoded}`],
  ['spam report', `/suppression/spam_reports/${encoded}`],
  ['global unsubscribe', `/asm/suppressions/global/${encoded}`],
];
let checkedAny = false;
for (const [label, path] of suppressions) {
  const res = await api(path);
  if (res.status === 401 || res.status === 403) continue;
  checkedAny = true;
  const hit = Array.isArray(res.body) ? res.body.length > 0 : Boolean(res.body?.recipient_email);
  if (hit) bad(`${TO} is on the ${label} list — SendGrid will accept the send and silently drop it. Remove it in Suppressions.`);
  else ok(`not on the ${label} list`);
}
if (!checkedAny) warn('suppression lists not readable with this key — cannot rule out a silent drop');

// ── 5. Summary ──────────────────────────────────────────────────────────────
head('Summary');
if (failed) {
  console.log(`  ${failed} hard failure(s). Fix them before sending.\n`);
  process.exit(1);
}
console.log('  Configuration looks deliverable.');
console.log(`  Next: node scripts/preview-emails.mjs --send ${TO}\n`);
