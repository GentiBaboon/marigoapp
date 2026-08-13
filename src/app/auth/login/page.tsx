import { Suspense } from 'react';
import { LoginContent } from './login-content';

/**
 * The Suspense boundary is required, not decorative: the content below reads
 * `useSearchParams()`, and a statically exported page may only do that beneath
 * one — without it the native build fails to prerender this route.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
