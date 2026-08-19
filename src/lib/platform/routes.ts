/**
 * @fileOverview Web path ⇄ native path translation.
 *
 * ## Why this exists
 *
 * `output: 'export'` cannot emit a route for an id it does not know at build
 * time, and a marketplace has unbounded product / order / conversation ids. So
 * the native bundle carries one static page per dynamic route and passes the id
 * in the query string instead of the path:
 *
 *     web     /products/abc123
 *     native  /products/view/?id=abc123
 *
 * Both resolve to the *same* React component. `useRouteParam()` reads the id
 * from whichever place it lives, so pages stay identical across all three
 * platforms and the web keeps its SEO-friendly URLs.
 *
 * Nothing in feature code calls this directly: `NativeRouteBridge` rewrites
 * links as they are clicked. Keep the table below in sync when a new dynamic
 * route is added, or that route will 404 on device while working fine on web.
 */

/** A dynamic web route and the flat native page that stands in for it. */
type RouteRule = {
  /** Matches the web path. Capture groups feed `params`, in order. */
  pattern: RegExp;
  /** The statically exported native path. */
  nativePath: string;
  /** Query keys for the capture groups — same names as the `[segment]`s. */
  params: string[];
};

/**
 * Longest / most specific first: `/products/[id]/edit` must be tested before
 * `/products/[id]`, or the bare rule swallows it and `edit` becomes the id.
 */
const ROUTE_RULES: RouteRule[] = [
  {
    pattern: /^\/products\/([^/]+)\/offers\/([^/]+)$/,
    nativePath: '/products/offer',
    params: ['id', 'offerId'],
  },
  { pattern: /^\/products\/([^/]+)\/edit$/, nativePath: '/products/edit', params: ['id'] },
  { pattern: /^\/products\/([^/]+)$/, nativePath: '/products/view', params: ['id'] },
  {
    pattern: /^\/messages\/([^/]+)$/,
    nativePath: '/messages/view',
    params: ['conversationId'],
  },
  {
    pattern: /^\/profile\/listings\/sales\/([^/]+)$/,
    nativePath: '/profile/listings/sales/view',
    params: ['orderId'],
  },
  {
    pattern: /^\/profile\/orders\/([^/]+)$/,
    nativePath: '/profile/orders/view',
    params: ['orderId'],
  },
  {
    pattern: /^\/checkout\/success\/([^/]+)$/,
    nativePath: '/checkout/success/view',
    params: ['orderId'],
  },
  {
    pattern: /^\/courier\/delivery\/([^/]+)$/,
    nativePath: '/courier/delivery/view',
    params: ['deliveryId'],
  },
  { pattern: /^\/admin\/orders\/([^/]+)$/, nativePath: '/admin/orders/view', params: ['id'] },
  { pattern: /^\/admin\/products\/([^/]+)$/, nativePath: '/admin/products/view', params: ['id'] },
  // Catch-all. The whole tail becomes one value and is re-split on read.
  { pattern: /^\/browse\/(.+)$/, nativePath: '/browse/view', params: ['slug'] },
];

/**
 * The flat native paths, for the build to assert every rule has a real page
 * behind it. Exported for the route table test.
 */
export const NATIVE_ROUTE_PATHS = ROUTE_RULES.map((r) => r.nativePath);

/**
 * Guards against translating an already-translated href.
 *
 * `/products/view/?id=abc` matches the `/products/([^/]+)` rule with `view` as
 * the id, which would rewrite it to `/products/view/?id=view` and lose the real
 * product. Both the click bridge and `useAppRouter` can see the same href, so
 * this has to be idempotent.
 */
const NATIVE_PATH_SET = new Set(NATIVE_ROUTE_PATHS);

export { ROUTE_RULES as __ROUTE_RULES_FOR_TEST };

/**
 * Rewrites a web href for the native bundle. Anything that is not a dynamic
 * app route — external URLs, hashes, already-flat paths — is returned as-is.
 */
export function toNativeHref(href: string): string {
  // Leave absolute URLs, protocol-relative URLs, mailto:, tel: and bare
  // fragments alone. Only in-app paths are ours to rewrite.
  if (!href.startsWith('/') || href.startsWith('//')) return href;

  const hashAt = href.indexOf('#');
  const hash = hashAt === -1 ? '' : href.slice(hashAt);
  const withoutHash = hashAt === -1 ? href : href.slice(0, hashAt);

  const queryAt = withoutHash.indexOf('?');
  const existingQuery = queryAt === -1 ? '' : withoutHash.slice(queryAt + 1);
  const path = (queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt)).replace(/\/+$/, '');

  if (NATIVE_PATH_SET.has(path)) return href;

  for (const rule of ROUTE_RULES) {
    const match = path.match(rule.pattern);
    if (!match) continue;

    const query = new URLSearchParams(existingQuery);
    rule.params.forEach((name, i) => {
      const value = match[i + 1];
      if (value) query.set(name, decodeURIComponent(value));
    });

    // Trailing slash matches `trailingSlash: true` in the native build, so the
    // WebView resolves the directory's index.html without a redirect hop.
    return `${rule.nativePath}/?${query.toString()}${hash}`;
  }

  return href;
}
