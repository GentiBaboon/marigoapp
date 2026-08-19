'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { isNativeApp } from './native';
import { toNativeHref } from './routes';

/**
 * `useRouter()` with native path translation applied to `push` / `replace`.
 *
 * Anchor clicks are handled centrally by `NativeRouteBridge`, but a
 * programmatic `router.push('/products/abc')` never touches the DOM, so it has
 * to be translated at the call site. Use this hook instead of `useRouter()`
 * whenever the destination contains an id; for static destinations either works.
 *
 * On web it returns the real router untouched.
 */
export function useAppRouter() {
  const router = useRouter();

  return useMemo(() => {
    if (!isNativeApp()) return router;

    return {
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(toNativeHref(href), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(toNativeHref(href), options),
      prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) =>
        router.prefetch(toNativeHref(href), options),
    };
  }, [router]);
}
