'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { useCatalogs } from '@/hooks/use-catalog';
import { buildCategoryPath, titleiseSlug } from '@/lib/category-url';
import { cn } from '@/lib/utils';
import type { FirestoreProduct } from '@/lib/types';

interface Crumb {
  label: string;
  href?: string;
}

type CatalogRow = { id: string; name?: string; slug?: string; parentId?: string | null };

const GENDER_HOME: Record<string, string> = {
  women: 'Women Home',
  men: 'Men Home',
  children: 'Children Home',
  unisex: 'Unisex Home',
};

/**
 * The category trail under a listing: Women Home › Brand › Category › Subcategory.
 *
 * Every crumb needs a *slug* to link with, and the product stores slugs for
 * only one of them: `brandId` and `categoryId` hold display **names**, while
 * `subcategoryId` holds a slug. That is the same asymmetry `/search` works
 * around client-side — so names are mapped back through the catalog here, and
 * a crumb whose slug cannot be resolved renders as plain text rather than a
 * link that would land on an empty result set.
 *
 * Catalog data comes from `useCatalogs`, which is session-cached, so this costs
 * no extra Firestore reads once any category or brand list has loaded.
 */
export function ProductBreadcrumb({
  product,
  className,
}: {
  product: Pick<FirestoreProduct, 'gender' | 'brandId' | 'categoryId' | 'subcategoryId'>;
  className?: string;
}) {
  const { data } = useCatalogs<CatalogRow>(['brands', 'categories']);
  const brands = data.brands ?? [];
  const categories = data.categories ?? [];

  const crumbs = React.useMemo<Crumb[]>(() => {
    const out: Crumb[] = [];
    const gender = (product.gender ?? '').toLowerCase();

    if (gender) {
      out.push({
        label: GENDER_HOME[gender] ?? `${titleiseSlug(gender)} Home`,
        href: buildCategoryPath(gender),
      });
    }

    // products.brandId stores the brand NAME; /search?brand= expects its slug.
    if (product.brandId) {
      const slug = brands.find(
        b => (b.name ?? '').toLowerCase() === product.brandId.toLowerCase()
      )?.slug;
      const params = new URLSearchParams();
      if (gender) params.set('gender', gender);
      if (slug) params.set('brand', slug);
      out.push({
        label: product.brandId,
        href: slug ? `/search?${params.toString()}` : undefined,
      });
    }

    // products.categoryId also stores the NAME, matched against a top-level
    // (parentless) catalog row.
    //
    // This links to /browse/{slug}, the same destination the header's own
    // category nav uses — deliberately not `/search?categoryId={slug}`, which
    // is filtered client-side over a single paginated page and shows "No
    // products found" whenever the matches sit outside the newest ten.
    if (product.categoryId) {
      const slug = categories.find(
        c => !c.parentId && (c.name ?? '').toLowerCase() === product.categoryId.toLowerCase()
      )?.slug;
      out.push({
        label: product.categoryId,
        href: slug ? `/browse/${slug}` : undefined,
      });
    }

    // The last crumb is where you already are, so it is never a link.
    if (product.subcategoryId) {
      const label =
        categories.find(c => c.slug === product.subcategoryId)?.name ??
        titleiseSlug(product.subcategoryId);
      out.push({ label });
    }

    return out;
  }, [product.gender, product.brandId, product.categoryId, product.subcategoryId, brands, categories]);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-x-2">
              {i > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-60" />}
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="transition-colors hover:text-foreground hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span className={cn(isLast && 'text-foreground')} aria-current={isLast ? 'page' : undefined}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
