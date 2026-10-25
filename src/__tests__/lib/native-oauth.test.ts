import { describe, expect, it, vi } from 'vitest';

vi.mock('@/firebase/auth/actions', () => ({
  getErrorMessage: (e: any) => `mapped:${e?.code ?? e?.message}`,
}));

import { isCancellation, nativeErrorMessage } from '@/firebase/auth/native-oauth';

describe('isCancellation', () => {
  it('recognises Android Google, which sends the status as the message only', () => {
    expect(isCancellation({ message: '12501: ' })).toBe(true);
  });

  it('recognises the iOS codes and wording', () => {
    expect(isCancellation({ code: '-5', message: 'x' })).toBe(true);
    expect(isCancellation({ code: '1001', message: 'x' })).toBe(true);
    expect(isCancellation({ message: 'The user canceled the sign-in flow.' })).toBe(true);
  });

  it('does not swallow real failures', () => {
    expect(isCancellation({ message: '10: ' })).toBe(false);
    expect(isCancellation({ code: 'auth/network-request-failed', message: 'x' })).toBe(false);
    expect(isCancellation({ message: '125010: ' })).toBe(false);
  });
});

describe('nativeErrorMessage', () => {
  it('turns a bare Play services status into a sentence that keeps the code', () => {
    expect(nativeErrorMessage({ message: '10: ' })).toContain('code 10');
  });

  it('leaves Firebase errors to the shared mapper', () => {
    expect(nativeErrorMessage({ code: 'auth/user-disabled', message: 'x' })).toBe('mapped:auth/user-disabled');
  });
});
