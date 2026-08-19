import { Suspense } from 'react';
import { SignupContent } from './signup-content';

/**
 * See the login route: the Suspense boundary is what lets a statically exported
 * page read `useSearchParams()`.
 */
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}
