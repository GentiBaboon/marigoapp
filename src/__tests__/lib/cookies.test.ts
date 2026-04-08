import { describe, it, expect, beforeEach } from 'vitest';
import { getCookie, setCookie, deleteCookie } from '@/lib/cookies';

describe('cookies', () => {
  beforeEach(() => {
    // Clear all cookies
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      if (name) document.cookie = `${name}=; max-age=0; path=/`;
    });
  });

  it('setCookie and getCookie round-trip', () => {
    setCookie('test_key', 'test_value', 1);
    expect(getCookie('test_key')).toBe('test_value');
  });

  it('getCookie returns undefined for missing cookie', () => {
    expect(getCookie('nonexistent')).toBeUndefined();
  });

  it('deleteCookie removes an existing cookie', () => {
    setCookie('to_delete', 'value', 1);
    expect(getCookie('to_delete')).toBe('value');
    deleteCookie('to_delete');
    expect(getCookie('to_delete')).toBeUndefined();
  });
});
