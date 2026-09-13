import { describe, it, expect } from 'vitest';
import {
  buildShippingLabel,
  esc,
  itemRef,
  paymentMethodLabel,
  shippingLabelHtml,
} from '@/lib/shipping-label';
import type { FirestoreOrder } from '@/lib/types';

const ADDRESS = {
  firstName: 'Egli',
  surname: 'Hoxha',
  fullName: 'Egli Hoxha',
  phone: '+355 69 123 4567',
  address: 'Rruga e Durrësit 120',
  apartment: 'Ap. 4',
  city: 'Tiranë',
  postal: '1001',
  country: 'Albania',
} as any;

const ORDER = {
  id: 'ord1',
  orderNumber: 'MG-COD-1788704529846',
  buyerId: 'buyer1',
  sellerIds: ['seller1'],
  items: [
    { id: 'p1', title: 'Royal Blue Heels', price: 25, brand: 'ZARA', image: '', sellerId: 'seller1', selectedSize: '38' },
  ],
  subtotal: 25,
  shippingFee: 2.15,
  totalAmount: 27.15,
  status: 'in_preparation',
  paymentMethod: 'cod',
  shippingAddress: ADDRESS,
  createdAt: '2026-09-13T10:00:00.000Z',
} as unknown as FirestoreOrder;

const seller = { name: 'Gigis Closet', email: 'malokugigi@gmail.com' };
const buyer = { name: 'Eglis Closet', email: 'eglis@example.com' };
const build = (order: FirestoreOrder = ORDER, sellerId = 'seller1') =>
  buildShippingLabel({ order, sellerId, seller, buyer });

describe('paymentMethodLabel', () => {
  it('names the method a courier acts on', () => {
    expect(paymentMethodLabel('cod')).toBe('Cash on delivery');
    expect(paymentMethodLabel('card')).toBe('Card — already paid');
    expect(paymentMethodLabel(undefined)).toBe('Not recorded');
  });
});

describe('itemRef', () => {
  it('is the first 8 characters, from either id field', () => {
    expect(itemRef({ id: 'abcdefghijkl' })).toBe('abcdefgh');
    expect(itemRef({ productId: 'xyz123456789' })).toBe('xyz12345');
    expect(itemRef({})).toBe('');
  });
});

describe('buildShippingLabel', () => {
  it('carries every field the label prints', () => {
    const m = build();
    expect(m.orderNumber).toBe('MG-COD-1788704529846');
    expect(m.seller.name).toBe('Gigis Closet');
    expect(m.buyer.email).toBe('eglis@example.com');
    expect(m.shipTo.city).toBe('Tiranë');
    expect(m.lines).toEqual([
      { title: 'Royal Blue Heels', brand: 'ZARA', size: '38', quantity: 1, ref: 'p1' },
    ]);
    expect(m.itemCount).toBe(1);
    expect(m.merchandiseEur).toBe(25);
    expect(m.shippingEur).toBe(2.15);
    expect(m.totalEur).toBe(27.15);
    expect(m.paymentLabel).toBe('Cash on delivery');
    expect(m.collectOnDelivery).toBe(true);
    expect(m.isSoleSeller).toBe(true);
  });

  it('counts units, not lines', () => {
    const order = { ...ORDER, items: [{ ...ORDER.items[0], quantity: 3 }] } as FirestoreOrder;
    const m = build(order);
    expect(m.itemCount).toBe(3);
    expect(m.merchandiseEur).toBe(75);
  });

  it('prints only this seller’s items, and flags the shared order', () => {
    const order = {
      ...ORDER,
      sellerIds: ['seller1', 'seller2'],
      items: [
        ORDER.items[0],
        { id: 'p2', title: 'Silk Scarf', price: 40, brand: 'HERMÈS', image: '', sellerId: 'seller2' },
      ],
    } as FirestoreOrder;
    const m = build(order);
    expect(m.lines.map((l) => l.title)).toEqual(['Royal Blue Heels']);
    expect(m.merchandiseEur).toBe(25);
    expect(m.isSoleSeller).toBe(false);
  });

  it('falls back to every line when the order predates per-line sellerId', () => {
    const order = { ...ORDER, items: [{ id: 'p1', title: 'Old', price: 10, brand: '', image: '' }] } as any;
    const m = build(order);
    expect(m.lines).toHaveLength(1);
    expect(m.merchandiseEur).toBe(10);
  });

  it('a card order collects nothing at the door', () => {
    const m = build({ ...ORDER, paymentMethod: 'card' } as FirestoreOrder);
    expect(m.collectOnDelivery).toBe(false);
    expect(m.paymentLabel).toBe('Card — already paid');
  });
});

describe('esc', () => {
  it('neutralises markup', () => {
    expect(esc('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(esc(undefined)).toBe('');
  });
});

describe('shippingLabelHtml', () => {
  const money = (eur: number) => `${(eur * 93).toLocaleString('de-DE')} ALL`;
  const html = () => shippingLabelHtml(build(), money);

  it('is one self-contained document with no external stylesheet', () => {
    const h = html();
    expect(h.startsWith('<!doctype html>')).toBe(true);
    expect(h).toContain('<style>');
    expect(h).not.toContain('<link');
  });

  it('shows the logo, the order id and both parties', () => {
    const h = html();
    expect(h).toContain('/logo-black.png');
    expect(h).toContain('MG-COD-1788704529846');
    expect(h).toContain('Gigis Closet');
    expect(h).toContain('Eglis Closet');
    expect(h).toContain('eglis@example.com');
  });

  it('shows the delivery address, the item and the three money lines', () => {
    const h = html();
    expect(h).toContain('Rruga e Durrësit 120, Ap. 4');
    expect(h).toContain('1001 Tiranë');
    expect(h).toContain('+355 69 123 4567');
    expect(h).toContain('ZARA — Royal Blue Heels');
    expect(h).toContain('Size 38');
    expect(h).toContain(money(25));
    expect(h).toContain(money(2.15));
    expect(h).toContain(money(27.15));
  });

  it('tells the courier what to collect on a cash order, and nothing on a card one', () => {
    expect(html()).toContain('Collect on delivery');
    const card = shippingLabelHtml(build({ ...ORDER, paymentMethod: 'card' } as FirestoreOrder), money);
    expect(card).not.toContain('Collect on delivery');
    expect(card).toContain('Card — already paid');
  });

  it('warns when the cash total covers another seller’s items too', () => {
    const order = {
      ...ORDER,
      items: [ORDER.items[0], { id: 'p2', title: 'Scarf', price: 40, brand: '', image: '', sellerId: 'seller2' }],
    } as FirestoreOrder;
    const h = shippingLabelHtml(build(order), money);
    expect(h).toMatch(/collected once/i);
  });

  it('escapes names and titles rather than emitting them raw', () => {
    const order = {
      ...ORDER,
      items: [{ ...ORDER.items[0], title: '<img src=x onerror=alert(1)>' }],
    } as FirestoreOrder;
    const h = shippingLabelHtml(
      buildShippingLabel({ order, sellerId: 'seller1', seller: { name: '<b>S</b>' }, buyer }),
      money,
    );
    expect(h).not.toContain('<img src=x');
    expect(h).not.toContain('<b>S</b>');
    expect(h).toContain('&lt;img src=x');
  });
});
