/**
 * Render every email template to public/../email-previews/ so they can be
 * eyeballed in a browser without sending anything.
 *
 *   node scripts/preview-emails.mjs          # writes previews + an index
 *   node scripts/preview-emails.mjs --send you@example.com
 *
 * `--send` posts them through SendGrid for real, which is the only way to see
 * how Gmail and Outlook actually render them — a browser is a poor proxy for
 * an email client. It needs SENDGRID_API_KEY in the environment.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));
// See scripts/generate-sitemap.mjs — jiti needs the tsconfig `@/*` alias.
const jiti = require('jiti')(ROOT, { alias: { '@': join(ROOT, 'src') } });

// .env.local is not loaded outside Next.
if (existsSync(join(ROOT, '.env.local'))) {
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const T = jiti('./src/lib/email/templates.ts');
const { sendEmail } = jiti('./src/lib/email/client.ts');

const ORDER_ITEMS = [
  { brand: 'Gucci', title: 'Vintage Gucci Heels', price: 80 },
  { brand: 'Zara', title: 'Snake Print Bag', price: 15 },
];

// One realistic sample per template.
const SAMPLES = {
  welcome: T.welcomeEmail({ name: 'Elira Hoxha' }),
  'password-reset': T.passwordResetEmail({ name: 'Elira', resetLink: 'https://www.marigoapp.com/auth/reset-password?oobCode=sample' }),
  'verify-email': T.emailVerificationEmail({ name: 'Elira', verifyLink: 'https://www.marigoapp.com/auth/verify-email?oobCode=sample' }),
  'order-confirmation': T.orderConfirmationEmail({
    buyerName: 'Elira Hoxha', orderNumber: 'MG-1042', orderId: 'ord_1042',
    items: ORDER_ITEMS, subtotal: 95, shipping: 1.93, totalAmount: 96.93, paymentMethod: 'card',
    shippingAddress: { fullName: 'Elira Hoxha', address: 'Rruga e Kavajës 12', city: 'Tiranë', postal: '1001', country: 'Albania' },
  }),
  'order-shipped': T.orderShippedEmail({ buyerName: 'Elira', orderNumber: 'MG-1042', orderId: 'ord_1042', courier: 'Marigo Delivery', trackingCode: 'MGD-8891' }),
  'order-delivered': T.orderDeliveredEmail({ buyerName: 'Elira', orderNumber: 'MG-1042', orderId: 'ord_1042' }),
  'order-cancelled': T.orderCancelledEmail({ buyerName: 'Elira', orderNumber: 'MG-1042', orderId: 'ord_1042', reason: 'The item was no longer available' }),
  refund: T.refundIssuedEmail({ buyerName: 'Elira', orderNumber: 'MG-1042', orderId: 'ord_1042', amount: 96.93 }),
  'seller-new-order': T.sellerNewOrderEmail({ sellerName: 'Gigis Closet', orderNumber: 'MG-1042', orderId: 'ord_1042', items: ORDER_ITEMS, totalAmount: 96.93 }),
  payout: T.payoutSentEmail({ sellerName: 'Gigis Closet', amount: 80.75, orderNumber: 'MG-1042' }),
  'listing-approved': T.listingApprovedEmail({ sellerName: 'Gigis Closet', productTitle: 'Vintage Gucci Heels', productPath: '/products/vintage-gucci-heels-dark-brown-38' }),
  'listing-rejected': T.listingRejectedEmail({ sellerName: 'Gigis Closet', productTitle: 'Vintage Gucci Heels', reason: 'The photos are too blurry to verify the item. Please re-shoot in daylight.' }),
  'offer-received': T.offerReceivedEmail({ sellerName: 'Gigis Closet', buyerName: 'Elira', productTitle: 'Vintage Gucci Heels', amount: 70, offerPath: '/products/vintage-gucci-heels-dark-brown-38/offers/off_1' }),
  'offer-accepted': T.offerAcceptedEmail({ buyerName: 'Elira', productTitle: 'Vintage Gucci Heels', amount: 70, productPath: '/products/vintage-gucci-heels-dark-brown-38' }),
  'offer-declined': T.offerDeclinedEmail({ buyerName: 'Elira', productTitle: 'Vintage Gucci Heels', productPath: '/products/vintage-gucci-heels-dark-brown-38' }),
  'new-message': T.newMessageEmail({ recipientName: 'Gigis Closet', senderName: 'Elira', productTitle: 'Vintage Gucci Heels', preview: 'Hi! Are these still available in a 38?', conversationId: 'conv_1' }),
  'return-requested': T.returnRequestedEmail({ sellerName: 'Gigis Closet', orderNumber: 'MG-1042', orderId: 'ord_1042', reason: 'Item does not match the description' }),
  'return-resolved': T.returnResolvedEmail({ name: 'Elira', orderNumber: 'MG-1042', orderId: 'ord_1042', outcome: 'Refunded in full' }),
};

const sendTo = process.argv.includes('--send')
  ? process.argv[process.argv.indexOf('--send') + 1]
  : null;

const OUT = join(ROOT, 'email-previews');
mkdirSync(OUT, { recursive: true });

const names = Object.keys(SAMPLES);
for (const name of names) {
  writeFileSync(join(OUT, `${name}.html`), SAMPLES[name].html);
}

writeFileSync(
  join(OUT, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Marigo email templates</title>
<body style="font-family:system-ui;max-width:760px;margin:40px auto;padding:0 20px;">
<h1>Marigo email templates</h1>
<p style="color:#666;">${names.length} transactional templates. Rendered with sample data — nothing was sent.</p>
<ul style="line-height:2;">
${names.map((n) => `  <li><a href="./${n}.html">${n}</a> — <span style="color:#666;">${SAMPLES[n].subject}</span></li>`).join('\n')}
</ul></body>`,
);

console.log(`Wrote ${names.length} previews to email-previews/`);
console.log('Open email-previews/index.html in a browser.\n');

if (sendTo) {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('--send needs SENDGRID_API_KEY in the environment.');
    process.exit(1);
  }
  console.log(`Sending ${names.length} test emails to ${sendTo}...`);
  for (const name of names) {
    const s = SAMPLES[name];
    const res = await sendEmail({ to: sendTo, subject: `[test] ${s.subject}`, html: s.html, category: s.category });
    console.log(`  ${res.ok ? 'sent  ' : 'FAILED'} ${name}${res.error ? ` — ${res.error}` : ''}`);
  }
}
