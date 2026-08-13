'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNativeApp } from '@/lib/platform/native';
import { toNativeHref } from '@/lib/platform/routes';
import { installNativeFetch } from '@/lib/platform/api';

/**
 * Makes the app's ~60 `<Link href="/products/${id}">` call sites work unchanged
 * inside the Capacitor shells.
 *
 * The native bundle is a static export, so `/products/abc` is not a file that
 * exists — the id has to move into the query string (see `lib/platform/routes`).
 * Rather than rewrite every link in the codebase and rely on nobody forgetting
 * the helper in future, this listens for clicks in the **capture** phase and
 * redirects the navigation before React's own handler runs.
 *
 * Mounted once in the root layout. On web it attaches nothing at all.
 */
export function NativeRouteBridge() {
  const router = useRouter();

  // Deliberately during render, not in an effect: this component sits above the
  // providers in the root layout, so patching here lands before any child has
  // rendered and had a chance to fetch. The call is idempotent and a no-op on web.
  installNativeFetch();

  useEffect(() => {
    if (!isNativeApp()) return;

    const onClick = (event: MouseEvent) => {
      // Let the browser handle anything that isn't a plain left-click, so
      // modified clicks and middle-clicks keep their normal meaning.
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor) return;

      // `getAttribute` rather than `.href`: the property is resolved against the
      // WebView's origin and would hand back `capacitor://localhost/products/abc`,
      // which no longer looks like an in-app path to the rewriter.
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.getAttribute('target') === '_blank') return;

      const nativeHref = toNativeHref(href);
      if (nativeHref === href) return;

      // Capture phase + stopPropagation keeps React's Link handler from also
      // pushing the untranslated path.
      event.preventDefault();
      event.stopPropagation();
      router.push(nativeHref);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return null;
}
