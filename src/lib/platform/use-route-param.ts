'use client';

import { useParams, useSearchParams } from 'next/navigation';

/**
 * Reads a route parameter regardless of how the platform carries it.
 *
 * On web the id is a path segment (`/products/abc` → `useParams().id`); in the
 * native bundle the same page is reached at `/products/view/?id=abc`, because a
 * static export cannot emit a route per product. Pages call this instead of
 * `useParams()` so one component serves web, iOS and Android unchanged.
 *
 * The path segment wins when both are present — on web a stray `?id=` in the
 * URL must never override the canonical path.
 */
export function useRouteParam(name: string): string | undefined {
  const params = useParams();
  const searchParams = useSearchParams();

  const fromPath = params?.[name];
  if (typeof fromPath === 'string' && fromPath) return fromPath;
  if (Array.isArray(fromPath) && fromPath.length) return fromPath.join('/');

  return searchParams?.get(name) ?? undefined;
}

/**
 * Drop-in replacement for `useParams()` that also sees native query params.
 *
 * Pages import it aliased — `import { useRouteParams as useParams }` — so the
 * existing `params.id` / `params.orderId` bodies keep working untouched on all
 * three platforms. Path segments take precedence over query values.
 */
export function useRouteParams(): Record<string, string | string[]> {
  const params = useParams();
  const searchParams = useSearchParams();

  const merged: Record<string, string | string[]> = {};
  searchParams?.forEach((value, key) => {
    merged[key] = value;
  });
  // Applied second so a real path segment always beats a stray query string.
  Object.assign(merged, params ?? {});
  return merged;
}

/**
 * The catch-all variant, for `/browse/[...slug]`. Native flattens the segments
 * into a single `?slug=a/b/c`, so both shapes come back as an array.
 */
export function useRouteParamSegments(name: string): string[] {
  const params = useParams();
  const searchParams = useSearchParams();

  const fromPath = params?.[name];
  if (Array.isArray(fromPath)) return fromPath;
  if (typeof fromPath === 'string' && fromPath) return fromPath.split('/');

  const fromQuery = searchParams?.get(name);
  return fromQuery ? fromQuery.split('/').filter(Boolean) : [];
}
