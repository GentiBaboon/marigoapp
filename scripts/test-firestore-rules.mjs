// Exercises firestore.rules against the Firestore emulator over plain REST.
//
//   npm run test:rules
//
// No dependencies beyond firebase-tools (already a devDependency) and a JVM
// for the emulator: the emulator accepts an unsigned (alg: none) JWT as the
// caller, and `Bearer owner` bypasses rules for seeding. Each case is a
// write or read *as* a particular uid and the HTTP status the rules should
// answer with — 200 allowed, 403 denied.
//
// Not part of `npm test`: CI has no JVM. Run it whenever firestore.rules
// changes, and before `firebase deploy --only firestore:rules`.
//
// Coverage: the account-ban and role-lock rules (CLAUDE.md §6d) — the two
// things a member could previously undo about themselves — and the coupon
// counter grant that checkout depends on. Add a case per rule you touch;
// the harness is the part that was missing.

const PROJECT = 'demo-marigo';
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (uid) => {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    sub: uid, user_id: uid, uid,
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT,
    auth_time: now, iat: now, exp: now + 3600,
    firebase: { sign_in_provider: 'custom', identities: {} },
  })}.`;
};

const enc = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
};
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));

async function call(method, url, body, as) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${as === 'owner' ? 'owner' : token(as)}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status;
}
// create: POST parent?documentId=
const create = (path, data, as) => {
  const i = path.lastIndexOf('/');
  return call('POST', `${BASE}/${path.slice(0, i)}?documentId=${path.slice(i + 1)}`, { fields: fields(data) }, as);
};
// update with a mask so the rules see exactly the touched keys
const update = (path, data, as) => {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  return call('PATCH', `${BASE}/${path}?${mask}&currentDocument.exists=true`, { fields: fields(data) }, as);
};
const del = (path, as) => call('DELETE', `${BASE}/${path}`, undefined, as);

// ── seed ────────────────────────────────────────────────────────────────────
await create('users/seller', { role: 'buyer', status: 'active', name: 'Seller' }, 'owner');
await create('users/buyer', { role: 'buyer', status: 'active', name: 'Buyer' }, 'owner');
await create('users/banned', { role: 'buyer', status: 'banned', name: 'Banned' }, 'owner');
await create('users/admin1', { role: 'admin', status: 'active', name: 'Admin' }, 'owner');
await create('users/doomed', { role: 'buyer', status: 'banned', name: 'Doomed' }, 'owner');
await create('products/p1', { sellerId: 'seller', price: 100, quantity: 1, status: 'active', title: 'Bag' }, 'owner');
await create('products/p2', { sellerId: 'seller', price: 100, quantity: 1, status: 'active', title: 'Bag 2' }, 'owner');
await create('products/p3', { sellerId: 'banned', price: 100, quantity: 1, status: 'active', title: 'Banned seller bag' }, 'owner');
await create('conversations/c1', { participants: ['banned', 'seller'] }, 'owner');
await create('products/p1/offers/o-open', { buyerId: 'banned', sellerId: 'seller', offerAmount: 40, amount: 40, status: 'pending' }, 'owner');

const offer = (buyer) => ({ buyerId: buyer, sellerId: 'seller', offerAmount: 50, amount: 50, status: 'pending' });
await create('coupons/w10', { code: 'WELCOME10', usedCount: 0, value: 10, isActive: true, firstOrderOnly: true }, 'owner');
// Payouts: one order the seller is on, and one withdrawal request of theirs.
await create('orders/o-settle', { buyerId: 'buyer', sellerIds: ['seller'], status: 'completed' }, 'owner');
await create('payout_requests/pr1', { sellerId: 'seller', amount: 60, status: 'pending', bank: { iban: 'AL35' } }, 'owner');
const payoutReq = (sellerId, extra = {}) => ({ sellerId, amount: 60, status: 'pending', bank: { iban: 'AL35' }, ...extra });

// ── cases ───────────────────────────────────────────────────────────────────
const cases = [
  // Coupons: checkout spends one with the buyer's own token, so a member may
  // move `usedCount` by exactly +1 and nothing else. The first real
  // cash-on-delivery order died on a 403 here.
  ['buyer can spend a coupon (usedCount +1)', 200, () => update('coupons/w10', { usedCount: 1 }, 'buyer')],
  ['buyer cannot jump the counter (+2)', 403, () => update('coupons/w10', { usedCount: 3 }, 'buyer')],
  ['buyer cannot wind the counter back', 403, () => update('coupons/w10', { usedCount: 0 }, 'buyer')],
  ['buyer cannot change a coupon\'s value', 403, () => update('coupons/w10', { value: 90 }, 'buyer')],
  ['buyer cannot bump the counter and the value together', 403, () => update('coupons/w10', { usedCount: 2, value: 90 }, 'buyer')],
  ['banned member cannot spend a coupon', 403, () => update('coupons/w10', { usedCount: 2 }, 'banned')],
  ['buyer cannot create a coupon', 403, () => create('coupons/fake', { code: 'FREE', usedCount: 0, value: 100 }, 'buyer')],
  ['buyer cannot delete a coupon', 403, () => del('coupons/w10', 'buyer')],
  ['admin can still edit a coupon freely', 200, () => update('coupons/w10', { value: 15, usedCount: 7 }, 'admin1')],
  // The bug that started this
  ['active buyer can make an offer', 200, () => create('products/p1/offers/a1', offer('buyer'), 'buyer')],
  ['banned buyer cannot make an offer', 403, () => create('products/p2/offers/b1', offer('banned'), 'banned')],
  ['banned buyer cannot withdraw their open offer', 403, () => update('products/p1/offers/o-open', { status: 'withdrawn' }, 'banned')],
  ['seller can still decline the banned buyer\'s open offer', 200, () => update('products/p1/offers/o-open', { status: 'declined' }, 'seller')],

  // Self-service escalation and self-unban
  ['owner cannot promote themselves', 403, () => update('users/buyer', { role: 'super_admin' }, 'buyer')],
  ['owner cannot change their own status', 403, () => update('users/buyer', { status: 'banned' }, 'buyer')],
  ['banned owner cannot unban themselves', 403, () => update('users/banned', { status: 'active' }, 'banned')],
  ['banned owner cannot edit their profile', 403, () => update('users/banned', { name: 'New name' }, 'banned')],
  ['owner can still edit their profile', 200, () => update('users/buyer', { name: 'Renamed', phone: '1' }, 'buyer')],
  ['owner can still record lastLoginAt', 200, () => update('users/buyer', { lastLoginAt: 'now' }, 'buyer')],
  ['owner cannot delete their own account document', 403, () => del('users/buyer', 'buyer')],
  ['another member cannot delete a user', 403, () => del('users/doomed', 'seller')],
  ['full admin can delete a user', 200, () => del('users/doomed', 'admin1')],
  ['first login bootstrap (buyer/active) is allowed', 200, () => create('users/newbie', { role: 'buyer', status: 'active', name: 'N' }, 'newbie')],
  ['first login cannot bootstrap as admin', 403, () => create('users/newbie2', { role: 'admin', status: 'active' }, 'newbie2')],
  ['first login cannot bootstrap without role/status (defaults apply)', 200, () => create('users/newbie3', { name: 'N3' }, 'newbie3')],

  // Admin keeps every lever
  ['admin can ban', 200, () => update('users/buyer', { status: 'banned' }, 'admin1')],
  ['admin can unban', 200, () => update('users/buyer', { status: 'active' }, 'admin1')],
  ['admin can change a role', 200, () => update('users/seller', { role: 'seller' }, 'admin1')],

  // Everything else a member can write
  ['banned cannot list a product', 403, () => create('products/pb', { sellerId: 'banned', price: 10, title: 'x' }, 'banned')],
  ['active can list a product', 200, () => create('products/pa', { sellerId: 'buyer', price: 10, title: 'x' }, 'buyer')],
  ['banned seller cannot edit their own listing', 403, () => update('products/p3', { price: 5 }, 'banned')],
  ['admin can still edit the banned seller\'s listing', 200, () => update('products/p3', { status: 'removed' }, 'admin1')],
  ['banned cannot take stock at checkout', 403, () => update('products/p2', { quantity: 0, status: 'reserved' }, 'banned')],
  ['active can take stock at checkout', 200, () => update('products/p2', { quantity: 0, status: 'reserved' }, 'buyer')],
  ['banned cannot create an order', 403, () => create('orders/ob', { buyerId: 'banned', sellerIds: ['seller'] }, 'banned')],
  ['active can create an order', 200, () => create('orders/oa', { buyerId: 'buyer', sellerIds: ['seller'] }, 'buyer')],
  ['banned cannot start a conversation', 403, () => create('conversations/cb', { participants: ['banned', 'seller'] }, 'banned')],
  ['banned cannot message in an existing conversation', 403, () => create('conversations/c1/messages/m1', { senderId: 'banned', text: 'hi' }, 'banned')],
  ['the other party can still message the banned user', 200, () => create('conversations/c1/messages/m2', { senderId: 'seller', text: 'hi' }, 'seller')],
  ['banned cannot spam notifications', 403, () => create('notifications/nb', { userId: 'seller', title: 'x' }, 'banned')],
  ['banned cannot file a report', 403, () => create('reports/rb', { reporterId: 'banned' }, 'banned')],
  ['banned cannot open a support chat', 403, () => create('support_chats/sb', { userId: 'banned' }, 'banned')],
  ['banned cannot open a dispute', 403, () => create('disputes/db', { buyerId: 'banned' }, 'banned')],
  ['banned cannot apply as a courier', 403, () => create('courier_profiles/banned', { userId: 'banned' }, 'banned')],

  // Payouts — money leaving the platform.
  //
  // The orders update rule lets a buyer or seller drive their own order, so
  // `cashSettledAt` (which is what releases a seller's money) has to be carved
  // out explicitly or a seller could stamp it and pay themselves out of cash
  // Marigo has not received.
  ['seller cannot mark their own order cash-settled', 403, () => update('orders/o-settle', { cashSettledAt: 'now' }, 'seller')],
  ['buyer cannot mark an order cash-settled either', 403, () => update('orders/o-settle', { cashSettledAt: 'now' }, 'buyer')],
  ['seller can still update their own order otherwise', 200, () => update('orders/o-settle', { status: 'completed' }, 'seller')],
  ['admin can mark an order cash-settled', 200, () => update('orders/o-settle', { cashSettledAt: 'now', cashSettledBy: 'admin1' }, 'admin1')],

  ['seller can open their own withdrawal request', 200, () => create('payout_requests/pr-new', payoutReq('seller'), 'seller')],
  ['nobody can file a withdrawal in someone else\'s name', 403, () => create('payout_requests/pr-forged', payoutReq('seller'), 'buyer')],
  ['a request cannot be created already approved', 403, () => create('payout_requests/pr-self', payoutReq('buyer', { status: 'approved' }), 'buyer')],
  ['a request cannot be created for nothing', 403, () => create('payout_requests/pr-zero', payoutReq('buyer', { amount: 0 }), 'buyer')],
  ['banned member cannot ask to be paid out', 403, () => create('payout_requests/pr-banned', payoutReq('banned'), 'banned')],
  ['seller cannot approve their own request', 403, () => update('payout_requests/pr1', { status: 'approved' }, 'seller')],
  ['seller cannot raise the amount after filing', 403, () => update('payout_requests/pr1', { amount: 9999 }, 'seller')],
  ['seller can read their own request', 200, () => call('GET', `${BASE}/payout_requests/pr1`, undefined, 'seller')],
  ['another member cannot read someone\'s bank details', 403, () => call('GET', `${BASE}/payout_requests/pr1`, undefined, 'buyer')],
  ['admin can read a request', 200, () => call('GET', `${BASE}/payout_requests/pr1`, undefined, 'admin1')],
  ['admin can mark it paid', 200, () => update('payout_requests/pr1', { status: 'paid' }, 'admin1')],

  // Reads are untouched
  ['banned can still read a product', 200, () => call('GET', `${BASE}/products/p1`, undefined, 'banned')],
  ['banned can still read their own offer', 200, () => call('GET', `${BASE}/products/p1/offers/o-open`, undefined, 'banned')],
];

let failed = 0;
for (const [name, want, fn] of cases) {
  const got = await fn();
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (want ${want}, got ${got})`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
