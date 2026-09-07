import { Suspense } from 'react';
import { VerifyEmailContent } from './verify-email-content';

/**
 * The Suspense boundary is required, not decorative: the content reads
 * `useSearchParams()` for `?next`, and a statically exported page may only
 * do that beneath one — without it the native build fails to prerender.
 */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
