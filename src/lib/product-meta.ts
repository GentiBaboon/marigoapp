/**
 * Meta title and description for a listing.
 *
 * Both were derived inline and neither respected the length Google actually
 * shows: titles came out around 65 characters and descriptions were the
 * seller's prose sliced at 300, which cut mid-word ("…slight fading of m").
 * A truncated description is worse than a short one — it reads as broken in
 * the result and wastes the snippet.
 *
 * So: compose to fit, and never cut a word. Used by
 * `products/[id]/layout.tsx` for the real tags and by the admin SEO panel,
 * which is what keeps the preview honest.
 */
import { SITE_NAME } from '@/lib/site';

/** Google truncates a title around here. */
export const MAX_META_TITLE = 60;
/** …and a description around here. */
export const MAX_META_DESCRIPTION = 155;

export interface MetaProduct {
  title?: string;
  description?: string;
  brandId?: string;
  categoryId?: string;
  subcategoryId?: string;
  condition?: string;
  color?: string;
  material?: string;
  size?: string;
  price?: number;
}

/** Slug or stored value → readable words: `very-good-condition` → `very good`. */
function humanise(value: string | undefined, stripSuffix?: string): string {
  let v = (value ?? '').trim().replace(/[-_]+/g, ' ');
  if (stripSuffix && v.toLowerCase().endsWith(stripSuffix)) {
    v = v.slice(0, -stripSuffix.length).trim();
  }
  return v;
}

/** Trim to a limit without cutting a word in half. Adds no ellipsis — a clean
 *  short sentence reads better in a result than a trailing "…". */
export function trimToWord(text: string, max: number): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:–—-]+$/, '');
}

/** Keep whole sentences only, up to a limit. Returns '' if even the first
 *  sentence is too long — the caller then composes its own. */
function firstSentencesWithin(text: string, max: number): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return '';
  let out = '';
  for (const s of sentences) {
    const next = (out + s).trim();
    if (next.length > max) break;
    out = next + ' ';
  }
  return out.trim();
}

/**
 * `Brand Title | MarigoApp`, shortened in the order that loses least:
 * drop the site suffix first, then trim the title. The brand and product name
 * are what someone scans for, so they survive longest.
 */
export function buildMetaTitle(product: MetaProduct): string {
  const title = (product.title ?? '').trim();
  if (!title) return SITE_NAME;

  const brand = (product.brandId ?? '').trim();
  const startsWithBrand = !!brand && title.toLowerCase().startsWith(brand.toLowerCase());
  const headline = startsWithBrand || !brand ? title : `${brand} ${title}`;

  const withSuffix = `${headline} | ${SITE_NAME}`;
  if (withSuffix.length <= MAX_META_TITLE) return withSuffix;
  if (headline.length <= MAX_META_TITLE) return headline;
  return trimToWord(headline, MAX_META_TITLE);
}

/**
 * Prefer the seller's own words — they describe the actual item — but only
 * whole sentences that fit. When the prose is one long sentence, or there is
 * none, compose from the attributes instead, which at least states what the
 * thing is.
 */
export function buildMetaDescription(product: MetaProduct): string {
  const fromSeller = firstSentencesWithin(product.description ?? '', MAX_META_DESCRIPTION);
  // A single short sentence ("Nice bag.") is a worse snippet than a composed
  // one carrying brand, condition and size.
  if (fromSeller.length >= 80) return fromSeller;

  const brand = (product.brandId ?? '').trim();
  const title = (product.title ?? '').trim();
  const startsWithBrand = !!brand && title.toLowerCase().startsWith(brand.toLowerCase());
  const subject = startsWithBrand || !brand ? title : `${brand} ${title}`;

  const facts: string[] = [];
  const color = humanise(product.color);
  if (color) facts.push(`in ${color}`);
  const material = humanise(product.material);
  if (material) facts.push(material.toLowerCase());
  const size = (product.size ?? '').trim();
  if (size) facts.push(`size ${size}`);

  const condition = humanise(product.condition, ' condition');
  const sentences: string[] = [];

  if (subject) {
    sentences.push(facts.length ? `${subject} ${facts.join(', ')}.` : `${subject}.`);
  }
  if (condition) sentences.push(`${condition.charAt(0).toUpperCase()}${condition.slice(1)} condition.`);

  // Closing line carries the reason to click: authenticity and protection are
  // what a resale shopper is weighing.
  sentences.push(`Authenticated pre-owned luxury on ${SITE_NAME}, with buyer protection and delivery across Albania, Italy and the EU.`);

  let out = '';
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > MAX_META_DESCRIPTION) break;
    out = next;
  }

  // Every sentence too long on its own — fall back to a word-safe trim rather
  // than emitting nothing.
  return out || trimToWord(sentences[0] ?? subject, MAX_META_DESCRIPTION);
}
