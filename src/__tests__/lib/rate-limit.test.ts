import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '@/lib/rate-limit';

describe('createRateLimiter', () => {
  it('allows requests within the limit', () => {
    const limiter = createRateLimiter('test-allow', { limit: 3, windowSeconds: 60 });
    const r1 = limiter.check('ip1');
    const r2 = limiter.check('ip1');
    const r3 = limiter.check('ip1');

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests exceeding the limit', () => {
    const limiter = createRateLimiter('test-block', { limit: 2, windowSeconds: 60 });
    limiter.check('ip2');
    limiter.check('ip2');
    const r3 = limiter.check('ip2');

    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('tracks different keys independently', () => {
    const limiter = createRateLimiter('test-keys', { limit: 1, windowSeconds: 60 });
    const r1 = limiter.check('ipA');
    const r2 = limiter.check('ipB');

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);

    expect(limiter.check('ipA').allowed).toBe(false);
    expect(limiter.check('ipB').allowed).toBe(false);
  });
});
