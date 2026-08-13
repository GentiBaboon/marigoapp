/**
 * @fileOverview Albanian ⇄ English fashion vocabulary for chat retrieval.
 *
 * Why this exists: listings are catalogued in English (`color: "coral"`,
 * `subcategoryId: "heels"`) but roughly half the visitors ask in Albanian.
 * "a ka taka portokalli?" matched nothing and the assistant truthfully but
 * wrongly answered "we don't have any" — while a pair of orange Zara heels was
 * sitting in the catalog.
 *
 * It also covers a second gap that bites English speakers: shade names. The
 * orange heels are stored as `coral`, so even "orange heels" only matched via
 * the title. Colour families map to their shades so both languages find them.
 *
 * Keys are stored **normalised** — lowercase, accents stripped — because that
 * is the form `normalize()` in chat-retrieval.ts produces. So the key for
 * "këpucë" is "kepuce" and for "çanta" is "canta".
 *
 * This is deliberately a static table rather than a translation call: it runs
 * in microseconds, costs nothing, and keeps brand/colour lookups working when
 * the model is unavailable.
 */

/**
 * term → other terms to also search for.
 *
 * Only expands *toward* the vocabulary the catalog actually uses. Adding the
 * reverse direction (English → Albanian) would be dead weight, since no listing
 * is written in Albanian.
 */
const ALIASES: Record<string, string[]> = {
  // ── Colours: Albanian → English ──
  kuqe: ['red', 'burgundy', 'maroon'],
  kuq: ['red'],
  zeze: ['black'],
  zi: ['black'],
  bardhe: ['white', 'ivory', 'cream'],
  bardh: ['white'],
  blu: ['blue', 'navy'],
  kalter: ['blue', 'light-blue'],
  kaltert: ['blue'],
  jeshile: ['green'],
  gjelber: ['green'],
  verdhe: ['yellow'],
  verdha: ['yellow'],
  portokalli: ['orange', 'coral', 'peach', 'apricot', 'rust', 'tangerine'],
  roze: ['pink', 'baby-pink', 'light-pink', 'rose', 'fuchsia'],
  kafe: ['brown', 'dark-brown', 'chocolate', 'tan', 'camel'],
  gri: ['grey', 'gray'],
  vjollce: ['purple', 'violet', 'lilac', 'lavender'],
  manushaqe: ['purple', 'violet'],
  bezhe: ['beige', 'cream', 'nude', 'ivory'],
  ari: ['gold', 'golden'],
  arte: ['gold'],
  argjend: ['silver'],
  argjendi: ['silver'],
  shumengjyresh: ['multicolor', 'multicoloured'],
  ngjyra: ['color', 'colour'],

  // ── Colours: English → the shades actually stored on listings ──
  orange: ['coral', 'peach', 'apricot', 'rust', 'tangerine'],
  pink: ['baby-pink', 'light-pink', 'rose', 'fuchsia', 'magenta'],
  brown: ['dark-brown', 'chocolate', 'tan', 'camel'],
  red: ['burgundy', 'maroon', 'crimson'],
  blue: ['navy', 'light-blue', 'sky-blue'],
  white: ['ivory', 'cream', 'off-white'],
  grey: ['gray', 'charcoal'],
  gray: ['grey', 'charcoal'],
  purple: ['violet', 'lilac', 'lavender'],
  beige: ['nude', 'cream', 'ivory'],

  // ── Garments & categories: Albanian → English ──
  taka: ['heels', 'heel', 'shoes'],
  take: ['heels'],
  kepuce: ['shoes', 'shoe'],
  kepucet: ['shoes'],
  cizme: ['boots', 'boot'],
  sandale: ['sandals'],
  atlete: ['sneakers', 'trainers'],
  canta: ['bag', 'handbag', 'bags'],
  cante: ['bag', 'handbag', 'bags'],
  cantat: ['bags', 'handbag'],
  fustan: ['dress', 'dresses'],
  fustane: ['dresses', 'dress'],
  fund: ['skirt', 'skirts'],
  funde: ['skirt', 'skirts'],
  pantallona: ['trousers', 'pants'],
  xhinse: ['jeans', 'denim'],
  xhins: ['jeans', 'denim'],
  bluze: ['top', 'tops', 'blouse'],
  bluza: ['tops', 'top', 'blouse'],
  kemishe: ['shirt', 'shirts'],
  kemisha: ['shirts', 'shirt'],
  maice: ['t-shirt', 'tshirt', 'tee'],
  xhakete: ['jacket', 'jackets'],
  xhaketa: ['jackets', 'jacket'],
  pallto: ['coat', 'coats'],
  triko: ['knitwear', 'sweater', 'jumper'],
  rrip: ['belt', 'belts'],
  rripa: ['belts', 'belt'],
  syze: ['sunglasses', 'glasses'],
  ore: ['watch', 'watches'],
  bizhuteri: ['jewellery', 'jewelry'],
  unaze: ['ring', 'rings'],
  gjerdan: ['necklace'],
  vathe: ['earrings'],
  corape: ['socks'],
  kapele: ['hat', 'cap'],
  shall: ['scarf'],
  doreza: ['gloves'],
  kostum: ['suit'],
  geta: ['leggings'],
  papuce: ['slippers', 'flats'],
  bikini: ['swimwear', 'swimsuit'],
  duks: ['hoodie', 'sweatshirt'],
  bluzon: ['hoodie', 'sweatshirt'],
  xhemper: ['sweater', 'knitwear', 'jumper'],
  mengje: ['sleeve', 'sleeves'],
  dimri: ['winter'],
  veres: ['summer'],
  masa: ['size'],
  numri: ['size'],
  veshje: ['clothing', 'clothes'],
  aksesore: ['accessories'],
  aksesoret: ['accessories'],

  // ── Materials ──
  lekure: ['leather'],
  lekur: ['leather'],
  pambuk: ['cotton'],
  mendafsh: ['silk'],
  lesh: ['wool'],
  kashmir: ['cashmere'],
  kadife: ['velvet'],
  liri: ['linen'],
  gezof: ['fur'],

  // ── Condition & attributes ──
  perdorur: ['used', 'pre-owned', 'second-hand'],
  vintazh: ['vintage'],
  vjeter: ['vintage', 'used'],

  // ── Departments ──
  grua: ['women', 'woman'],
  gruaje: ['women'],
  femra: ['women'],
  femer: ['women'],
  burra: ['men'],
  burrash: ['men'],
  mashkull: ['men'],
  femije: ['children', 'kids'],
  femijesh: ['children', 'kids'],

  // ── English plural/singular smoothing, so "bag" finds "handbag" etc. ──
  bag: ['handbag', 'bags'],
  bags: ['bag', 'handbag'],
  heel: ['heels'],
  heels: ['heel'],
  shoe: ['shoes'],
  dress: ['dresses'],
  dresses: ['dress'],
  jacket: ['jackets'],
  skirt: ['skirts'],
  belt: ['belts'],
  top: ['tops'],
  shirt: ['shirts', 't-shirt'],
  tshirt: ['t-shirt', 'tee'],
  sweater: ['knitwear', 'jumper'],
  jumper: ['knitwear', 'sweater'],
  trainers: ['sneakers'],
  sneakers: ['trainers'],
};

/**
 * A query token plus everything it should also match.
 *
 * Returns the token first so an exact hit still outranks a translated one —
 * `rank()` is lower-is-better and the caller takes the minimum.
 */
export function expandTerm(token: string): string[] {
  const aliases = ALIASES[token];
  return aliases ? [token, ...aliases] : [token];
}

/** Exposed for tests and for anyone auditing the coverage. */
export const LEXICON_TERMS = Object.keys(ALIASES);

/**
 * Terms naming a *kind of product*, as opposed to an attribute like colour or
 * material.
 *
 * These carry more intent than the rest of the query: "fustan te zi" is a
 * request for a dress that happens to be black, not for anything black. Without
 * the distinction, a partial match on "zi" alone surfaced a black belt and a
 * black bag alongside the one dress.
 */
export const GARMENT_TERMS = new Set([
  // Albanian
  'taka', 'take', 'kepuce', 'kepucet', 'cizme', 'sandale', 'atlete',
  'canta', 'cante', 'cantat', 'fustan', 'fustane', 'fund', 'funde',
  'pantallona', 'xhinse', 'xhins', 'bluze', 'bluza', 'kemishe', 'kemisha',
  'maice', 'xhakete', 'xhaketa', 'pallto', 'triko', 'rrip', 'rripa', 'syze',
  'ore', 'bizhuteri', 'unaze', 'gjerdan', 'vathe', 'corape', 'kapele',
  'shall', 'doreza', 'kostum', 'veshje', 'aksesore', 'aksesoret',
  'geta', 'papuce', 'bikini', 'duks', 'bluzon', 'xhemper',
  // English
  'heel', 'heels', 'shoe', 'shoes', 'boot', 'boots', 'sandals', 'sneakers',
  'trainers', 'bag', 'bags', 'handbag', 'dress', 'dresses', 'skirt', 'skirts',
  'trousers', 'pants', 'jeans', 'denim', 'top', 'tops', 'blouse', 'shirt',
  'shirts', 't-shirt', 'tshirt', 'tee', 'jacket', 'jackets', 'coat', 'coats',
  'knitwear', 'sweater', 'jumper', 'belt', 'belts', 'sunglasses', 'glasses',
  'watch', 'watches', 'jewellery', 'jewelry', 'ring', 'rings', 'necklace',
  'earrings', 'socks', 'hat', 'cap', 'scarf', 'gloves', 'suit', 'clothing',
  'accessories', 'leggings', 'slippers', 'flats', 'swimwear', 'swimsuit',
  'hoodie', 'sweatshirt', 'blazer', 'vest',
]);

/** True when a query token names a product type rather than an attribute. */
export function isGarmentTerm(token: string): boolean {
  return GARMENT_TERMS.has(token);
}
