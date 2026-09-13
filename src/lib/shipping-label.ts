/**
 * The printable shipping label a seller attaches to the package.
 *
 * Pure and dependency-free: the model is built from the order plus the two
 * user documents, and rendered to a **self-contained HTML document**. Nothing
 * here touches the DOM, Firestore or the currency context, so every decision
 * on the label — whose items, whose money, what the courier collects — is
 * unit-testable without a browser.
 *
 * Why a standalone HTML document rather than a React tree with a print
 * stylesheet: the label is printed into a blank same-origin iframe, so none
 * of the app's CSS reaches it. No Tailwind preflight, no dark mode, no fixed
 * MobileNav bleeding onto the page, no Radix portal to fight. What is written
 * here is exactly what comes out of the printer.
 */
import type { AddressFormValues, FirestoreOrder } from './types';
import { orderMerchandise, orderShipping } from './order-money';

export interface LabelParty {
  /** As shown in the app — the profile name, not the Auth display name. */
  name: string;
  email?: string;
}

export interface LabelLine {
  title: string;
  brand?: string;
  size?: string | null;
  quantity: number;
  /** Short product reference, the same 8 characters the sale page shows. */
  ref: string;
}

export interface ShippingLabelModel {
  orderNumber: string;
  placedAt: Date | null;
  seller: LabelParty;
  buyer: LabelParty;
  shipTo: AddressFormValues;
  lines: LabelLine[];
  /** Units in this package, not lines — two of one item is two. */
  itemCount: number;
  /** This seller's merchandise. EUR. */
  merchandiseEur: number;
  /** The order's delivery fee. EUR. */
  shippingEur: number;
  /** The order's total — what a cash courier collects. EUR. */
  totalEur: number;
  paymentLabel: string;
  /** Cash on delivery: the courier collects `totalEur` at the door. */
  collectOnDelivery: boolean;
  /**
   * False when the order has items from other sellers too. The money below
   * is then the *order's*, not this package's, and the label says so —
   * otherwise two sellers print two labels each demanding the full cash
   * amount and the courier collects twice.
   */
  isSoleSeller: boolean;
}

const ONE = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 1;

/** The 8-character reference the sale page shows beside the item. */
export function itemRef(line: { id?: string; productId?: string }): string {
  return String(line.id || line.productId || '').slice(0, 8);
}

export function paymentMethodLabel(method: string | undefined): string {
  switch (method) {
    case 'cod':
      return 'Cash on delivery';
    case 'card':
      return 'Card — already paid';
    default:
      return method ? String(method) : 'Not recorded';
  }
}

/**
 * Build the label for one seller's package.
 *
 * **Only this seller's lines.** A multi-seller order ships as separate
 * packages, so another seller's items on this label would both misdescribe
 * the parcel and tell the buyer's courier what else they bought.
 */
export function buildShippingLabel(args: {
  order: FirestoreOrder;
  sellerId: string;
  seller: LabelParty;
  buyer: LabelParty;
  placedAt?: Date | null;
}): ShippingLabelModel {
  const { order, sellerId, seller, buyer } = args;
  const all = Array.isArray(order.items) ? order.items : [];
  const mine = all.filter((line) => line?.sellerId === sellerId);
  // A legacy order with no sellerId on its lines would otherwise print an
  // empty parcel; fall back to every line rather than nothing.
  const lines = mine.length > 0 ? mine : all;

  const sellerIds = new Set(all.map((l) => l?.sellerId).filter(Boolean) as string[]);

  return {
    orderNumber: order.orderNumber || order.id,
    placedAt: args.placedAt ?? null,
    seller,
    buyer,
    shipTo: order.shippingAddress,
    lines: lines.map((line) => ({
      title: line.title,
      brand: line.brand,
      size: line.selectedSize ?? null,
      quantity: ONE(line.quantity),
      ref: itemRef(line as { id?: string; productId?: string }),
    })),
    itemCount: lines.reduce((n, line) => n + ONE(line.quantity), 0),
    merchandiseEur: orderMerchandise(order, mine.length > 0 ? sellerId : undefined),
    shippingEur: orderShipping(order),
    totalEur: typeof order.totalAmount === 'number' ? order.totalAmount : 0,
    paymentLabel: paymentMethodLabel(order.paymentMethod),
    collectOnDelivery: order.paymentMethod === 'cod',
    isSoleSeller: sellerIds.size <= 1,
  };
}

/** Minimal escape. Local rather than imported from the email layout, which
 *  would drag the whole transactional-mail shell into this bundle. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function addressLines(a: AddressFormValues | undefined): string[] {
  if (!a) return [];
  const street = [a.address, a.apartment].filter(Boolean).join(', ');
  const town = [a.postal, a.city].filter(Boolean).join(' ');
  return [a.fullName, a.company, street, town, a.country, a.phone].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
}

/**
 * The document sent to the printer.
 *
 * No site URL is printed. Some browsers turn a bare domain in the body into
 * a link, and a printed label is not a place anyone follows one — the logo
 * already says whose parcel this is.
 *
 * `formatMoney` comes from the currency context, so the figures read in the
 * same currency as the rest of the app — which for this market is lekë, and
 * on a cash order is the amount the courier actually collects. Values are
 * stored in EUR; nothing here converts.
 */
export function shippingLabelHtml(
  model: ShippingLabelModel,
  formatMoney: (eur: number) => string,
  opts: { logoUrl?: string } = {},
): string {
  const logo = opts.logoUrl ?? '/logo-black.png';
  const money = (eur: number) => esc(formatMoney(eur));

  const items = model.lines
    .map((line) => {
      const head = [line.brand, line.title].filter(Boolean).map(esc).join(' — ');
      const bits = [line.size ? `Size ${esc(line.size)}` : '', line.ref ? `Ref. ${esc(line.ref)}` : '']
        .filter(Boolean)
        .join(' · ');
      return `<tr>
          <td class="qty">${line.quantity}×</td>
          <td><div class="item-name">${head}</div>${bits ? `<div class="muted">${bits}</div>` : ''}</td>
        </tr>`;
    })
    .join('');

  const shipTo = addressLines(model.shipTo)
    .map((l) => `<div>${esc(l)}</div>`)
    .join('');

  const collect = model.collectOnDelivery
    ? `<div class="collect">Collect on delivery: <strong>${money(model.totalEur)}</strong></div>`
    : '';

  const sharedNote = model.isSoleSeller
    ? ''
    : `<div class="note">This order also contains items from another seller. Transport and total are for the whole order and are collected once.</div>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Shipping label ${esc(model.orderNumber)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.45 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; }
  .label { border: 2px solid #111; padding: 14px 16px; max-width: 190mm; }
  .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
         border-bottom: 2px solid #111; padding-bottom: 10px; }
  .logo { height: 30px; width: auto; }
  .ref { text-align: right; }
  .ref .kind { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #555; }
  .ref .id { font-size: 17px; font-weight: 700; font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; }
  h2 { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #555;
       margin: 0 0 5px; font-weight: 700; }
  .parties { display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid #bbb; }
  .parties > div { flex: 1; min-width: 0; }
  .parties > div + div { border-left: 1px solid #ddd; padding-left: 16px; }
  .who { font-size: 14px; font-weight: 700; }
  .muted { color: #555; font-size: 11px; }
  .block { padding: 12px 0; border-bottom: 1px solid #bbb; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 3px 0; }
  td.qty { width: 34px; font-weight: 700; }
  .item-name { font-weight: 600; }
  .totals { width: 62%; margin-left: auto; }
  .totals td { padding: 3px 0; }
  .totals td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .totals tr.grand td { border-top: 1px solid #111; padding-top: 7px; font-size: 15px; font-weight: 700; }
  .pay { display: flex; justify-content: space-between; gap: 12px; align-items: center;
         padding-top: 10px; }
  .collect { border: 2px solid #111; padding: 6px 10px; font-size: 14px; }
  .note { margin-top: 8px; font-size: 10px; color: #555; }
  .foot { padding-top: 10px; font-size: 10px; color: #555; text-align: right; }
</style></head>
<body><div class="label">

  <div class="top">
    <img class="logo" src="${esc(logo)}" alt="Marigo">
    <div class="ref">
      <div class="kind">Shipping label</div>
      <div class="id">${esc(model.orderNumber)}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <h2>Seller</h2>
      <div class="who">${esc(model.seller.name)}</div>
      ${model.seller.email ? `<div class="muted">${esc(model.seller.email)}</div>` : ''}
    </div>
    <div>
      <h2>Buyer</h2>
      <div class="who">${esc(model.buyer.name)}</div>
      ${model.buyer.email ? `<div class="muted">${esc(model.buyer.email)}</div>` : ''}
    </div>
  </div>

  <div class="block">
    <h2>Deliver to</h2>
    ${shipTo || '<div class="muted">No address on the order</div>'}
  </div>

  <div class="block">
    <h2>Items (${model.itemCount})</h2>
    <table>${items}</table>
  </div>

  <div class="block">
    <table class="totals">
      <tr><td>Products (${model.itemCount})</td><td>${money(model.merchandiseEur)}</td></tr>
      <tr><td>Transport</td><td>${money(model.shippingEur)}</td></tr>
      <tr class="grand"><td>Total</td><td>${money(model.totalEur)}</td></tr>
    </table>
  </div>

  <div class="pay">
    <div><h2>Payment</h2><div class="who">${esc(model.paymentLabel)}</div></div>
    ${collect}
  </div>
  ${sharedNote}

  <div class="foot">
    ${model.placedAt ? `<span>Ordered ${esc(model.placedAt.toLocaleDateString('en-GB'))}</span>` : ''}
  </div>

</div></body></html>`;
}
