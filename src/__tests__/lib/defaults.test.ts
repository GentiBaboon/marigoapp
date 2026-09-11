import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as defaults from '@/lib/defaults';
import * as types from '@/lib/types';

describe('lib/defaults', () => {
  it('never imports zod or ./types as a value — it exists to keep them off the first load', () => {
    const src = readFileSync('src/lib/defaults.ts', 'utf8');
    const valueImports = [...src.matchAll(/^import (?!type )[^;]+from '([^']+)'/gm)].map((m) => m[1]);
    expect(valueImports).toEqual([]);
    expect(src).not.toMatch(/from ['"]zod['"]/);
  });

  it('is what types.ts re-exports, so both import paths agree', () => {
    for (const key of ['toDate', 'DEFAULT_SHIPPING_FEE_EUR', 'CROSS_BORDER_SHIPPING_FEE_EUR', 'DEFAULT_COMMISSION_RATE', 'DEFAULT_PAYOUT_HOLD_HOURS', 'DEFAULT_REFUND_WINDOW_DAYS', 'DEFAULT_BADGE_SETTINGS', 'getSellerLevel', 'resolveBadgeSettings', 'disputeKindLabel', 'DEFAULT_RELATED_PRODUCTS_CONFIG'] as const) {
      expect((types as any)[key], key).toBe((defaults as any)[key]);
    }
  });

  it('keeps the money figures', () => {
    expect(defaults.DEFAULT_SHIPPING_FEE_ALL).toBe(200);
    expect(defaults.CROSS_BORDER_SHIPPING_FEE_ALL).toBe(500);
    expect(defaults.DEFAULT_SHIPPING_FEE_EUR * 93).toBeCloseTo(200);
    expect(defaults.toDate({ seconds: 1, nanoseconds: 0 })?.getTime()).toBe(1000);
    expect(defaults.toDate(null)).toBeNull();
  });
});
