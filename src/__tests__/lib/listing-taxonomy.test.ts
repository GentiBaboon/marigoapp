import { describe, it, expect } from 'vitest';
import { matchOption, type TaxonomyOption } from '@/lib/listing-taxonomy';

/**
 * The AI listing assistant writes into the sell wizard's selects, so anything
 * it returns has to be an option those selects actually contain. A value the
 * wizard cannot bind renders as an empty field the seller cannot fix by
 * looking at it — worse than leaving it blank on purpose.
 */
const colors: TaxonomyOption[] = [
  { name: 'Orange', value: 'orange' },
  { name: 'Coral', value: 'coral' },
  { name: 'Dark Brown', value: 'dark-brown' },
  { name: 'Brown', value: 'brown' },
  { name: 'Black', value: 'black' },
];

const conditions: TaxonomyOption[] = [
  { name: 'New with tag', value: 'new-with-tag' },
  { name: 'New without tag', value: 'new-without-tag' },
  { name: 'Very Good Condition', value: 'very-good-condition' },
  { name: 'Good Condition', value: 'good-condition' },
];

describe('matchOption', () => {
  it('matches the stored value directly', () => {
    expect(matchOption('coral', colors)).toBe('coral');
    expect(matchOption('good-condition', conditions)).toBe('good-condition');
  });

  it('matches the display name, case-insensitively', () => {
    expect(matchOption('Orange', colors)).toBe('orange');
    expect(matchOption('ORANGE', colors)).toBe('orange');
    expect(matchOption('Very Good Condition', conditions)).toBe('very-good-condition');
  });

  it('falls back to containment for wording the model invented', () => {
    // Models describe colour in prose; the catalog stores slugs.
    expect(matchOption('Burnt Orange', colors)).toBe('orange');
    expect(matchOption('a rich dark brown', colors)).toBe('dark-brown');
  });

  it('prefers the most specific option when several fit', () => {
    // "dark brown" contains "brown"; the narrower shade must win.
    expect(matchOption('dark brown', colors)).toBe('dark-brown');
  });

  it('matches a partial phrase against a longer option name', () => {
    expect(matchOption('Very Good', conditions)).toBe('very-good-condition');
  });

  it('returns null rather than guessing when nothing fits', () => {
    // The caller leaves the field empty; a wrong value would silently mislabel
    // the listing and the seller would have to notice it on the review screen.
    expect(matchOption('chartreuse', colors)).toBeNull();
    expect(matchOption('', colors)).toBeNull();
    expect(matchOption(undefined, colors)).toBeNull();
    expect(matchOption(null, colors)).toBeNull();
  });

  it('handles accents, since catalog names are latinised', () => {
    expect(matchOption('Órange', colors)).toBe('orange');
  });

  it('returns null against an empty option list', () => {
    expect(matchOption('orange', [])).toBeNull();
  });
});
