/**
 * @fileOverview `generateStaticParams` helper for the native export.
 *
 * Next's export check is `prerenderRoutes.length > 0` — it is not enough to
 * *have* a `generateStaticParams`, it must yield at least one route, or the
 * build fails with "missing generateStaticParams()". The marketplace's ids are
 * unbounded, so there is no real list to give it.
 *
 * The native bundle therefore emits a single throwaway page per dynamic route
 * and never links to it: real navigation goes to the flat `/view` siblings (see
 * `lib/platform/routes.ts`). The web build returns an empty list, which is
 * exactly what it did before any of this existed — every id still renders on
 * demand, and no placeholder page is ever served to a shopper.
 */

/** Segment value for the throwaway page. Distinctive so it is obvious in `out/`. */
export const NATIVE_PLACEHOLDER = '__native__';

/**
 * One placeholder route when building for Capacitor, nothing when building web.
 *
 * @param placeholder Params for the throwaway page — every dynamic segment on
 *                    the route, using `[NATIVE_PLACEHOLDER]` for catch-alls.
 */
export function nativeOnlyStaticParams<T extends Record<string, string | string[]>>(
  placeholder: T
): T[] {
  return process.env.NEXT_PUBLIC_BUILD_TARGET === 'native' ? [placeholder] : [];
}
