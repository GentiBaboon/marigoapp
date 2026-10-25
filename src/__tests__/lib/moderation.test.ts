import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPORT_REASONS,
  REPORT_DETAILS_MAX,
  buildUserReport,
  reportReasonLabel,
  blockPath,
  canReportOrBlock,
} from '@/lib/moderation';

const base = { reporterId: 'buyer', reportedUserId: 'seller', conversationId: 'c1', reason: 'harassment' as const };

describe('buildUserReport', () => {
  it('builds the shape the reports create rule accepts', () => {
    expect(buildUserReport({ ...base, details: '  said something awful  ' })).toEqual({
      type: 'user',
      itemId: 'seller',
      reportedUserId: 'seller',
      reporterId: 'buyer',
      reason: 'harassment',
      status: 'pending',
      source: 'conversation',
      conversationId: 'c1',
      details: 'said something awful',
    });
  });

  it('leaves out empty details rather than storing a blank string', () => {
    expect(buildUserReport({ ...base, details: '   ' })).not.toHaveProperty('details');
  });

  it('refuses a report about yourself, which the rules would also refuse', () => {
    expect(() => buildUserReport({ ...base, reportedUserId: 'buyer' })).toThrow(/yourself/);
  });

  it('refuses an unknown reason', () => {
    expect(() => buildUserReport({ ...base, reason: 'boring' as any })).toThrow(/reason/);
  });

  it('refuses details longer than the rule allows', () => {
    expect(() => buildUserReport({ ...base, details: 'x'.repeat(REPORT_DETAILS_MAX + 1) })).toThrow();
    expect(() => buildUserReport({ ...base, details: 'x'.repeat(REPORT_DETAILS_MAX) })).not.toThrow();
  });
});

describe('reportReasonLabel', () => {
  it('names every reason', () => {
    for (const r of REPORT_REASONS) expect(reportReasonLabel(r.value)).toBe(r.label);
  });

  it('passes legacy free-text reasons through', () => {
    expect(reportReasonLabel('Counterfeit item')).toBe('Counterfeit item');
  });
});

describe('canReportOrBlock', () => {
  const conv = {
    participants: ['buyer', 'seller'],
    participantDetails: [{ userId: 'buyer' }, { userId: 'seller' }],
  };

  it('allows it in an ordinary two-person thread', () => {
    expect(canReportOrBlock(conv, 'buyer')).toBe(true);
  });

  it('never offers it on a dispute thread', () => {
    expect(canReportOrBlock({ ...conv, source: 'dispute' }, 'buyer')).toBe(false);
  });

  it('never offers it against Marigo staff', () => {
    expect(canReportOrBlock({ ...conv, participantDetails: [{ userId: 'buyer' }, { userId: 'seller', role: 'admin' }] }, 'buyer')).toBe(false);
  });

  it('only between exactly two people, the case the rules enforce', () => {
    expect(canReportOrBlock({ ...conv, participants: ['buyer', 'seller', 'admin'] }, 'buyer')).toBe(false);
  });

  it('not for someone outside the thread', () => {
    expect(canReportOrBlock(conv, 'stranger')).toBe(false);
  });
});

describe('the rules agree with this module', () => {
  const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');

  it('caps report details at the same length', () => {
    expect(rules).toContain(`.size() <= ${REPORT_DETAILS_MAX}`);
  });

  it('stores blocks where blockedBetween() looks for them', () => {
    expect(blockPath('a', 'b')).toBe('users/a/blocks/b');
    expect(rules).toMatch(/match \/blocks\/\{blockedId\}/);
    expect(rules).toContain('/users/$(p[0])/blocks/$(p[1])');
  });
});
