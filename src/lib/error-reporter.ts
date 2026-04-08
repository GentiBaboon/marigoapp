/**
 * Centralized error reporting.
 *
 * In production, replace the console calls below with your monitoring
 * service (Sentry, LogRocket, Datadog, etc.):
 *
 *   import * as Sentry from '@sentry/nextjs';
 *   Sentry.captureException(error, { extra: context });
 *
 * This module gives every file a single import for error reporting,
 * so swapping the backend later is a one-file change.
 */

interface ErrorContext {
  /** Where the error originated (component, API route, hook, etc.) */
  source?: string;
  /** The authenticated user ID, if available */
  userId?: string;
  /** Any extra structured data useful for debugging */
  extra?: Record<string, unknown>;
}

/**
 * Report an error to the monitoring service.
 * Safe to call anywhere — never throws.
 */
export function reportError(error: unknown, context?: ErrorContext): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));

    // ── Production: send to monitoring service ──
    // Sentry.captureException(err, { extra: context });

    // ── Development: structured console output ──
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[${context?.source || 'app'}]`, err.message, context?.extra || '');
    }
  } catch {
    // Error reporter must never throw
  }
}

/**
 * Report a warning (non-fatal but unexpected condition).
 */
export function reportWarning(message: string, context?: ErrorContext): void {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[${context?.source || 'app'}]`, message, context?.extra || '');
    }
    // Sentry.captureMessage(message, { level: 'warning', extra: context });
  } catch {
    // noop
  }
}
