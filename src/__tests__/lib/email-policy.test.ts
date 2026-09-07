import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  DISPOSABLE_EMAIL_MESSAGE,
  emailDomain,
  emailPolicyError,
  isDisposableEmail,
  isDisposableEmailDomain,
} from '@/lib/email-policy';
import { DISPOSABLE_EMAIL_DOMAINS } from '@/lib/disposable-email-domains';
import { signupSchema } from '@/lib/types';

const ROOT = resolve(__dirname, '../../..');

describe('emailDomain', () => {
  it('takes the part after the last @, folded', () => {
    expect(emailDomain('  Someone@Example.COM ')).toBe('example.com');
    expect(emailDomain('a@b@c.org')).toBe('c.org');
  });
  it('is empty with no @', () => {
    expect(emailDomain('nobody')).toBe('');
    expect(emailDomain('')).toBe('');
  });
});

describe('isDisposableEmailDomain', () => {
  it('matches a listed domain and any subdomain of it', () => {
    expect(isDisposableEmailDomain('mailinator.com')).toBe(true);
    expect(isDisposableEmailDomain('foo.mailinator.com')).toBe(true);
    expect(isDisposableEmailDomain('MAILINATOR.COM')).toBe(true);
  });
  it('never matches on the TLD alone, nor a real provider', () => {
    expect(isDisposableEmailDomain('com')).toBe(false);
    expect(isDisposableEmailDomain('gmail.com')).toBe(false);
    expect(isDisposableEmailDomain('marigoapp.com')).toBe(false);
    expect(isDisposableEmailDomain('')).toBe(false);
  });
  it('does not treat a listed name as a suffix of an unrelated domain', () => {
    // "notyopmail.com" is not "yopmail.com" — label boundaries matter.
    expect(isDisposableEmailDomain('notyopmail.com')).toBe(false);
  });
});

describe('isDisposableEmail / emailPolicyError', () => {
  it('refuses a throwaway inbox with the shared message', () => {
    expect(isDisposableEmail('x@yopmail.com')).toBe(true);
    expect(emailPolicyError('x@yopmail.com')).toBe(DISPOSABLE_EMAIL_MESSAGE);
  });
  it('accepts an ordinary address', () => {
    expect(isDisposableEmail('x@gmail.com')).toBe(false);
    expect(emailPolicyError('x@gmail.com')).toBeNull();
  });
});

describe('signupSchema', () => {
  const base = { name: 'Ana', password: 'longenough', terms: true };
  it('refuses a disposable address before any account is created', () => {
    const r = signupSchema.safeParse({ ...base, email: 'ana@10minutemail.com' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe(DISPOSABLE_EMAIL_MESSAGE);
  });
  it('still accepts a real one', () => {
    expect(signupSchema.safeParse({ ...base, email: 'ana@gmail.com' }).success).toBe(true);
  });
});

describe('the domain list', () => {
  it('is lower-case, de-duplicated and sorted-free of blanks', () => {
    for (const d of DISPOSABLE_EMAIL_DOMAINS) {
      expect(d).toBe(d.trim().toLowerCase());
      expect(d).toMatch(/^[a-z0-9.-]+\.[a-z]+$/);
    }
    expect(new Set(DISPOSABLE_EMAIL_DOMAINS).size).toBe(DISPOSABLE_EMAIL_DOMAINS.length);
  });

  it('is byte-identical to the copy the Cloud Functions bundle ships', () => {
    // The functions package cannot import from src/, so the file is copied.
    // Both sides must refuse exactly the same inboxes, or an address the form
    // accepts is refused at creation (or the other way round).
    const app = readFileSync(join(ROOT, 'src/lib/disposable-email-domains.ts'), 'utf8');
    const fn = readFileSync(join(ROOT, 'functions/src/disposable-email-domains.ts'), 'utf8');
    expect(fn).toBe(app);
  });
});
