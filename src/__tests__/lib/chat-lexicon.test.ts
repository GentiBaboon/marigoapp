import { describe, it, expect } from 'vitest';
import { expandTerm, isGarmentTerm, GARMENT_TERMS, LEXICON_TERMS } from '@/lib/chat-lexicon';
import { parsePriceFilter } from '@/lib/chat-retrieval';

/**
 * "a keni dicka nen 50 euro?" used to tokenise to {50, euro}, match no product
 * field, and return nothing — one of the most natural shopping questions.
 */
describe('parsePriceFilter', () => {
  it('reads a ceiling in both languages', () => {
    expect(parsePriceFilter('anything under 20 euro?')).toEqual({ max: 20 });
    expect(parsePriceFilter('a keni dicka nen 50 euro?')).toEqual({ max: 50 });
    expect(parsePriceFilter('deri ne 100 euro')).toEqual({ max: 100 });
    expect(parsePriceFilter('max 75')).toEqual({ max: 75 });
  });

  it('reads a floor', () => {
    expect(parsePriceFilter('a keni çanta mbi 100 euro?')).toEqual({ min: 100 });
    expect(parsePriceFilter('bags over 200')).toEqual({ min: 200 });
  });

  it('treats a bare "cheap" as sort-by-price', () => {
    expect(parsePriceFilter('show me something cheap')).toEqual({ cheapest: true });
    expect(parsePriceFilter('a keni dicka me lire?')).toEqual({ cheapest: true });
  });

  it('survives Albanian diacritics', () => {
    // JavaScript's \b is ASCII-only, so /\blire\b/ never matches "lirë" in raw
    // text — the ë is not a word character. Parsing runs on normalised text.
    expect(parsePriceFilter('diçka e lirë')).toEqual({ cheapest: true });
    expect(parsePriceFilter('nën 30 euro')).toEqual({ max: 30 });
  });

  it('returns null when no price is mentioned', () => {
    expect(parsePriceFilter('a ka taka portokalli?')).toBeNull();
    expect(parsePriceFilter('how can I sell?')).toBeNull();
  });
});

/**
 * Regression cover for a reported miss: "a ka taka portokalli?" (are there
 * orange heels?) answered "no" while a pair of orange Zara heels was live.
 * Listings are catalogued in English, so Albanian terms matched nothing.
 */
describe('expandTerm', () => {
  it('maps Albanian garment words to the English the catalog uses', () => {
    expect(expandTerm('taka')).toContain('heels');
    expect(expandTerm('canta')).toContain('handbag');
    expect(expandTerm('fustan')).toContain('dress');
    expect(expandTerm('xhakete')).toContain('jacket');
    expect(expandTerm('rrip')).toContain('belt');
  });

  it('maps Albanian colours to English', () => {
    expect(expandTerm('portokalli')).toContain('orange');
    expect(expandTerm('zeze')).toContain('black');
    expect(expandTerm('kuqe')).toContain('red');
  });

  it('reaches the shade names listings actually store', () => {
    // The orange heels are recorded as `color: "coral"`, so "orange" alone
    // only matched via the title — English queries needed this too.
    expect(expandTerm('portokalli')).toContain('coral');
    expect(expandTerm('orange')).toContain('coral');
    expect(expandTerm('pink')).toContain('baby-pink');
    expect(expandTerm('brown')).toContain('dark-brown');
  });

  it('keeps the literal token first so exact hits outrank translations', () => {
    expect(expandTerm('taka')[0]).toBe('taka');
    expect(expandTerm('orange')[0]).toBe('orange');
  });

  it('returns unknown tokens untouched', () => {
    expect(expandTerm('gucci')).toEqual(['gucci']);
    expect(expandTerm('zara')).toEqual(['zara']);
  });

  it('never returns duplicates for a term', () => {
    for (const term of LEXICON_TERMS) {
      const expansion = expandTerm(term);
      expect(new Set(expansion).size).toBe(expansion.length);
    }
  });
});

/**
 * Product-type terms outrank attributes in a partial match. Without this,
 * "fustan te zi" (a black dress) surfaced a black belt and a black bag
 * alongside the one dress.
 */
describe('isGarmentTerm', () => {
  it.each(['taka', 'fustan', 'canta', 'rrip', 'heels', 'dress', 'bag', 'belt'])(
    'treats %j as a product type',
    (term) => expect(isGarmentTerm(term)).toBe(true),
  );

  it.each(['portokalli', 'zeze', 'orange', 'black', 'lekure', 'leather', 'vintazh'])(
    'treats %j as an attribute, not a product type',
    (term) => expect(isGarmentTerm(term)).toBe(false),
  );

  it('classifies the English side of every garment translation too', () => {
    // A partial match is filtered on the *query* token, but the same words
    // arrive from English speakers directly — both spellings must agree.
    for (const term of ['heels', 'shoes', 'bags', 'dresses', 'jackets', 'belts']) {
      expect(GARMENT_TERMS.has(term)).toBe(true);
    }
  });
});
