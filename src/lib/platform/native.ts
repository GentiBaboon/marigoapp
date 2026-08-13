/**
 * @fileOverview Runtime platform detection, shared by web / iOS / Android.
 *
 * The same `src/` tree is compiled twice (see `next.config.js`): once for the
 * SSR web app on Vercel, once as a static export bundled into the Capacitor
 * shells. `BUILD_TARGET` is what the compiler knows; `isNativeApp()` is what the
 * running code knows. They are deliberately separate — the static bundle is also
 * what you get when serving `out/` in a plain browser during development, and in
 * that case Capacitor is absent and the web behaviour is the correct one.
 */

/** True when this bundle was compiled for the Capacitor shells. */
export const IS_NATIVE_BUILD = process.env.NEXT_PUBLIC_BUILD_TARGET === 'native';

/**
 * True only when actually executing inside a Capacitor WebView.
 *
 * Checked lazily off `window` rather than cached at module scope, because this
 * module is imported during SSR of the web build where no window exists.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** 'ios' | 'android' | 'web' — 'web' both in a browser and in the dev export. */
export function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const platform = cap?.getPlatform?.();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}
