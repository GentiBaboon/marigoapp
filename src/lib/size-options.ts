/**
 * The canonical size vocabulary for the whole marketplace.
 *
 * Sizes used to be typed free-hand in two places (the Details step of the sell
 * wizard and the per-variant rows in Pricing), while the size facet on /search
 * matches with plain `===`. That combination made a listing saved as "Small"
 * unreachable from a filter pill reading "S" — the pill and the product are
 * both correct and they still never meet.
 *
 * So there is exactly one option list, and every entry point picks from it:
 *
 *   admin size charts  →  SIZE_PRESETS  →  UNIVERSAL_SIZES
 *
 * `resolveSizeOptions()` walks that order, so a category with no admin chart
 * still offers a sensible list instead of an empty dropdown or a text box.
 *
 * One value per size, never two. "Small" is not a separate option from "S" —
 * it is the *label* on "S" (`S — Small`), so sellers still recognise it and
 * search still has a single key to match on. `normalizeSize()` folds the
 * legacy spellings already in Firestore onto those same keys.
 */

export const SIZE_SYSTEMS = ['EU', 'US', 'UK', 'IT', 'FR', 'International'] as const;
export type SizeSystem = (typeof SIZE_SYSTEMS)[number];

export interface SizeOption {
  value: string;
  /** What the seller reads in the dropdown. Carries the long form so that a
   *  seller looking for "Medium" still finds it under the value `M`. */
  label: string;
}

export interface SizeChartLike {
  categoryType: string;
  sizeSystem: string;
  sizes: string[];
  isActive?: boolean;
}

/** Inclusive numeric range as strings. `step` may be fractional (shoe halves). */
function range(from: number, to: number, step = 1): string[] {
  const out: string[] = [];
  // Fixed iteration count rather than `n <= to`, so a fractional step can't
  // drop the last entry to floating-point drift.
  const steps = Math.round((to - from) / step);
  for (let i = 0; i <= steps; i += 1) {
    const n = from + i * step;
    out.push(Number.isInteger(n) ? String(n) : n.toFixed(1));
  }
  return out;
}

/** Letter sizes, in wearing order. The second entry is the long form. */
const ALPHA_SIZES: ReadonlyArray<readonly [string, string]> = [
  ['XXS', 'Extra extra small'],
  ['XS', 'Extra small'],
  ['S', 'Small'],
  ['M', 'Medium'],
  ['L', 'Large'],
  ['XL', 'Extra large'],
  ['XXL', 'Extra extra large'],
  ['3XL', 'Triple extra large'],
  ['4XL', 'Quadruple extra large'],
];

/** Bag-specific vocabulary — "Mini" and "Oversized" have no letter equivalent. */
const BAG_SIZES = ['Mini', 'XS', 'S', 'M', 'L', 'XL', 'Oversized', 'One Size'];

/** Baby/toddler ages, then child years. Kidswear is sized by age, not letters. */
const KIDS_AGE_SIZES = [
  'Preemie', 'Newborn', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M',
  '2Y', '3Y', '4Y', '5Y', '6Y', '7Y', '8Y', '9Y', '10Y', '11Y', '12Y', '13Y', '14Y', '15Y', '16Y',
];

/** Kidswear by height in cm — the EU convention alongside age. */
const KIDS_HEIGHT_SIZES = range(50, 176, 6);

const ALPHA_VALUES = ALPHA_SIZES.map(([v]) => v);
const ALPHA_WITH_ONE_SIZE = [...ALPHA_VALUES, 'One Size'];

/** Ring sizes (EU/ISO band circumference) plus the catch-alls jewellery uses. */
const RING_SIZES = range(41, 70);

/**
 * Per top-level category, per size system. Category keys must match the
 * `name` of a top-level document in `categories` — that is what the sell
 * wizard writes into `formData.categoryId` and what admin charts key on.
 */
export const SIZE_PRESETS: Record<string, Partial<Record<SizeSystem, string[]>>> = {
  Clothing: {
    International: ALPHA_WITH_ONE_SIZE,
    EU: range(30, 60),
    IT: range(34, 60),
    FR: range(30, 56),
    UK: range(2, 30),
    US: range(0, 24),
  },
  'Active Wear': {
    International: ALPHA_WITH_ONE_SIZE,
    EU: range(30, 60),
    IT: range(34, 60),
    FR: range(30, 56),
    UK: range(2, 30),
    US: range(0, 24),
  },
  Shoes: {
    EU: range(33, 50),
    IT: range(33, 50),
    FR: range(33, 50),
    UK: range(1, 15, 0.5),
    US: range(3, 16, 0.5),
    International: ['One Size'],
  },
  Bags: {
    International: BAG_SIZES,
  },
  Accessories: {
    // Belts are the numeric case here (cm), everything else is letter-sized.
    International: ['One Size', ...ALPHA_VALUES],
    EU: range(65, 125, 5),
  },
  'Jewellery & Watches': {
    International: ['One Size', 'XS', 'S', 'M', 'L', 'XL'],
    EU: RING_SIZES,
  },
  'Clothing for Girls': {
    International: KIDS_AGE_SIZES,
    EU: KIDS_HEIGHT_SIZES,
  },
  'Clothing for Boys': {
    International: KIDS_AGE_SIZES,
    EU: KIDS_HEIGHT_SIZES,
  },
  Baby: {
    International: KIDS_AGE_SIZES,
    EU: range(50, 104, 6),
  },
  "Children's Shoes": {
    EU: range(16, 40),
    IT: range(16, 40),
    UK: range(0, 8, 0.5),
    US: range(1, 9, 0.5),
  },
  "Children's Accessories": {
    International: ['One Size', ...KIDS_AGE_SIZES],
  },
  'Beauty & Skincare': {
    International: ['One Size'],
  },
  Home: {
    International: ['One Size', ...ALPHA_VALUES],
    EU: range(30, 300, 10),
  },
  Art: {
    International: ['One Size', 'S', 'M', 'L', 'XL'],
  },
};

/**
 * The catch-all. Used when a category has neither an admin chart nor a preset,
 * so that *every* category can be listed against a dropdown and no seller is
 * ever dropped back to a free-text box.
 */
export const UNIVERSAL_SIZES: string[] = dedupe([
  'One Size',
  ...ALPHA_VALUES,
  ...BAG_SIZES,
  ...KIDS_AGE_SIZES,
  ...range(0, 60),
  ...range(1, 16, 0.5),
  ...KIDS_HEIGHT_SIZES,
  ...range(65, 125, 5),
]);

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

const LONG_FORM = new Map<string, string>(ALPHA_SIZES.map(([v, long]) => [v, long]));

/** Dropdown label for a value: `S — Small`, but a bare `38` stays `38`. */
export function sizeLabel(value: string): string {
  const long = LONG_FORM.get(value);
  return long ? `${value} — ${long}` : value;
}

export function toSizeOptions(values: string[]): SizeOption[] {
  return dedupe(values).map((value) => ({ value, label: sizeLabel(value) }));
}

/**
 * Spellings seen in the wild (seller free text, AI drafts, older admin charts)
 * mapped onto the canonical value. Keys are compared upper-cased with
 * separators stripped, so "extra-small", "Extra Small" and "XSMALL" all land
 * on the same entry.
 */
const SIZE_SYNONYMS: Record<string, string> = {
  EXTRAEXTRASMALL: 'XXS', XXSMALL: 'XXS', '2XS': 'XXS', XXS: 'XXS',
  EXTRASMALL: 'XS', XSMALL: 'XS', XS: 'XS',
  SMALL: 'S', SM: 'S', S: 'S',
  MEDIUM: 'M', MED: 'M', M: 'M',
  LARGE: 'L', LG: 'L', L: 'L',
  EXTRALARGE: 'XL', XLARGE: 'XL', XL: 'XL',
  EXTRAEXTRALARGE: 'XXL', XXLARGE: 'XXL', '2XL': 'XXL', XXL: 'XXL',
  '3X': '3XL', XXXL: '3XL', '3XL': '3XL',
  '4X': '4XL', XXXXL: '4XL', '4XL': '4XL',
  ONESIZE: 'One Size', OS: 'One Size', OSFA: 'One Size', UNIVERSAL: 'One Size',
  TAILLEUNIQUE: 'One Size', UNICA: 'One Size', TAGLIAUNICA: 'One Size',
  NJENUMER: 'One Size', MASEUNIVERSALE: 'One Size',
  OVERSIZE: 'Oversized', OVERSIZED: 'Oversized',
  MINI: 'Mini',
};

/**
 * Fold a raw size string onto its canonical value.
 *
 * Returns the trimmed input unchanged when nothing matches — an unrecognised
 * size is still better than a blank one, and the caller decides whether to
 * keep it. Never throws.
 */
export function normalizeSize(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  // "38,5" is how a comma-decimal locale writes a half shoe size.
  const decimalised = trimmed.replace(',', '.');

  // Pure number: drop a trailing ".0" and any leading zeros ("08" → "8").
  const numeric = decimalised.match(/^(\d+(?:\.\d+)?)$/);
  if (numeric) {
    const n = Number(numeric[1]);
    if (Number.isFinite(n)) return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  // "EU 38" / "38 EU" / "Size 38" — keep the number, drop the system, which is
  // carried separately on the listing.
  const embedded = decimalised.match(
    /^(?:size\s*)?(?:eu|us|uk|it|fr|int(?:l|ernational)?)?\s*(\d+(?:\.\d+)?)\s*(?:eu|us|uk|it|fr)?$/i,
  );
  if (embedded) {
    const n = Number(embedded[1]);
    if (Number.isFinite(n)) return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  const key = decimalised.toUpperCase().replace(/[\s._/-]/g, '');
  if (SIZE_SYNONYMS[key]) return SIZE_SYNONYMS[key];

  // Age/height forms: "12 months" → "12M", "4 years" → "4Y", "3-6 months".
  const months = decimalised.match(/^(\d+)\s*(?:-\s*(\d+)\s*)?(?:m|mo|mos|months?|muaj)$/i);
  if (months) return months[2] ? `${months[1]}-${months[2]}M` : `${months[1]}M`;
  const years = decimalised.match(/^(\d+)\s*(?:y|yr|yrs|years?|vjec|vjeç)$/i);
  if (years) return `${years[1]}Y`;
  const cm = decimalised.match(/^(\d+)\s*cm$/i);
  if (cm) return cm[1];

  return trimmed;
}

/** True when two size strings mean the same size. */
export function sizesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeSize(a);
  const nb = normalizeSize(b);
  if (!na || !nb) return false;
  return na.toUpperCase() === nb.toUpperCase();
}

function activeCharts(charts: SizeChartLike[] | null | undefined): SizeChartLike[] {
  return (charts ?? []).filter((c) => c.isActive !== false && Array.isArray(c.sizes) && c.sizes.length > 0);
}

/**
 * Size systems offered for a category: whatever admin has configured, plus
 * every system the preset covers. Falls back to all systems so a brand-new
 * category is never a dead end.
 */
export function resolveSizeSystems(
  categoryType: string | null | undefined,
  charts?: SizeChartLike[] | null,
): string[] {
  const fromCharts = activeCharts(charts)
    .filter((c) => !categoryType || c.categoryType === categoryType)
    .map((c) => c.sizeSystem);
  const fromPresets = categoryType ? Object.keys(SIZE_PRESETS[categoryType] ?? {}) : [];
  const merged = dedupe([...fromCharts, ...fromPresets]);
  if (merged.length > 0) {
    // Keep the canonical display order rather than insertion order, with any
    // admin-invented system appended after the known ones.
    const known: string[] = SIZE_SYSTEMS.filter((s) => merged.includes(s));
    const extra = merged.filter((s) => !(SIZE_SYSTEMS as readonly string[]).includes(s));
    return [...known, ...extra];
  }
  return [...SIZE_SYSTEMS];
}

/**
 * The options a seller may pick from, in precedence order:
 *   1. the admin-configured chart for this category + system
 *   2. the built-in preset for this category + system
 *   3. every preset for this category (system not chosen yet, or unknown)
 *   4. UNIVERSAL_SIZES
 *
 * Always returns at least one option, so callers never need a text fallback.
 */
export function resolveSizeOptions(args: {
  categoryType?: string | null;
  sizeSystem?: string | null;
  charts?: SizeChartLike[] | null;
}): SizeOption[] {
  const { categoryType, sizeSystem, charts } = args;
  const active = activeCharts(charts);

  if (categoryType && sizeSystem) {
    const chart = active.find((c) => c.categoryType === categoryType && c.sizeSystem === sizeSystem);
    if (chart) return toSizeOptions(chart.sizes);
  }

  const preset = categoryType ? SIZE_PRESETS[categoryType] : undefined;
  if (preset && sizeSystem && preset[sizeSystem as SizeSystem]?.length) {
    return toSizeOptions(preset[sizeSystem as SizeSystem]!);
  }

  if (preset) {
    const everySystem = Object.values(preset).flat().filter(Boolean) as string[];
    if (everySystem.length > 0) return toSizeOptions(everySystem);
  }

  // No category context at all: offer whatever admin configured for this
  // system across categories before falling back to the universal list.
  if (sizeSystem) {
    const bySystem = active.filter((c) => c.sizeSystem === sizeSystem).flatMap((c) => c.sizes);
    if (bySystem.length > 0) return toSizeOptions(bySystem);
  }

  return toSizeOptions(UNIVERSAL_SIZES);
}
