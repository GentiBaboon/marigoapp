import { describe, expect, it } from 'vitest';
import {
  isStorablePushToken,
  PUSH_TOKENS_COLLECTION,
  pushTokenPath,
} from '@/lib/push/tokens';

describe('push token storage', () => {
  it('keeps tokens in an owner-only subcollection, not on the public user document', () => {
    // `users/{uid}` is world-readable (`allow get: if true`), so a token stored
    // as a field there would be a per-device identifier for every member,
    // readable by anyone. The path must stay one level deeper.
    const path = pushTokenPath('uid-1', 'abc123');
    expect(path).toBe(`users/uid-1/${PUSH_TOKENS_COLLECTION}/abc123`);
    expect(path.split('/')).toHaveLength(4);
  });

  it('accepts a real FCM token shape', () => {
    const fcm =
      'dGhpcy1pcy1hLWZha2UtdG9rZW4:APA91bHun4MxP5egoKMwt2KZFUh3aVLH-qwerty_1234';
    expect(isStorablePushToken(fcm)).toBe(true);
  });

  it('rejects anything that is not a legal Firestore document id', () => {
    // A slash would silently create a nested path instead of a document.
    expect(isStorablePushToken('abc/def')).toBe(false);
    expect(isStorablePushToken('.')).toBe(false);
    expect(isStorablePushToken('..')).toBe(false);
    expect(isStorablePushToken('__proto__')).toBe(false);
    expect(isStorablePushToken('')).toBe(false);
    expect(isStorablePushToken('a'.repeat(1501))).toBe(false);
  });

  it('rejects non-strings, which is what a failed token exchange yields', () => {
    expect(isStorablePushToken(undefined)).toBe(false);
    expect(isStorablePushToken(null)).toBe(false);
    expect(isStorablePushToken(42)).toBe(false);
    expect(isStorablePushToken({ value: 'abc' })).toBe(false);
  });
});
