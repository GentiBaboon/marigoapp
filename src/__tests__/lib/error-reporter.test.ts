import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportError, reportWarning } from '@/lib/error-reporter';

describe('error-reporter', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Ensure NODE_ENV is not 'production' so console calls fire
    vi.stubEnv('NODE_ENV', 'development');
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('reportError', () => {
    it('logs to console.error in dev mode with Error object', () => {
      const err = new Error('something broke');
      reportError(err, { source: 'TestComponent' });

      expect(errorSpy).toHaveBeenCalledOnce();
      expect(errorSpy).toHaveBeenCalledWith(
        '[TestComponent]',
        'something broke',
        ''
      );
    });

    it('handles plain string errors', () => {
      reportError('string error', { source: 'hook' });

      expect(errorSpy).toHaveBeenCalledOnce();
      // The implementation wraps strings in new Error(String(error))
      expect(errorSpy).toHaveBeenCalledWith(
        '[hook]',
        'string error',
        ''
      );
    });

    it('uses default source [app] when context has no source', () => {
      reportError(new Error('oops'));

      expect(errorSpy).toHaveBeenCalledWith('[app]', 'oops', '');
    });

    it('includes extra data when provided', () => {
      const extra = { orderId: '123', userId: 'u1' };
      reportError(new Error('fail'), { source: 'api', extra });

      expect(errorSpy).toHaveBeenCalledWith('[api]', 'fail', extra);
    });

    it('never throws even with unusual input', () => {
      expect(() => reportError(null)).not.toThrow();
      expect(() => reportError(undefined)).not.toThrow();
      expect(() => reportError(42)).not.toThrow();
      expect(() => reportError({ weird: true })).not.toThrow();
    });
  });

  describe('reportWarning', () => {
    it('logs to console.warn in dev mode', () => {
      reportWarning('watch out', { source: 'PaymentForm' });

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        '[PaymentForm]',
        'watch out',
        ''
      );
    });

    it('uses default source [app] when no source provided', () => {
      reportWarning('minor issue');

      expect(warnSpy).toHaveBeenCalledWith('[app]', 'minor issue', '');
    });

    it('never throws even with unusual input', () => {
      expect(() => reportWarning('')).not.toThrow();
      expect(() => reportWarning('msg', {} as any)).not.toThrow();
    });
  });

  describe('production mode', () => {
    it('does not log to console.error in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      reportError(new Error('prod error'));
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not log to console.warn in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      reportWarning('prod warning');
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
