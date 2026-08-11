import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site';
import { fetchProductForSeo, fetchProductReviews } from '@/lib/product-seo';

// Maps the stored condition slugs onto schema.org OfferItemCondition. The old
// JSON-LD compared against 'new', which is not a value this app ever stores
// (they are new-with-tag / new-without-tag / very-good-condition /
// good-condition), so every listing was reported as UsedCondition.
const CONDITION_URLS: Record<string, string> = {
  'new-with-tag': 'https://schema.org/NewCondition',
  'new-without-tag': 'https://schema.org/NewCondition',
  'very-good-condition': 'https://schema.org/UsedCondition',
  'good-condition': 'https://schema.org/UsedCondition',
};

type Props = { params: { id: string }; children: React.ReactNode };

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await fetchProductForSeo(params.id);
  const canonical = absoluteUrl(`/products/${params.id}`);

  if (!product?.title) {
    return { alternates: { canonical } };
  }

  // Most titles already lead with the brand ("Zara Orange High Heels"), so
  // prefixing unconditionally produced "ZARA Zara Orange High Heels".
  const brandId = product.brandId?.trim() ?? '';
  const titleStartsWithBrand =
    !!brandId && product.title.toLowerCase().startsWith(brandId.toLowerCase());
  const headline = titleStartsWithBrand || !brandId ? product.title : `${brandId} ${product.title}`;

  const title = `${headline} | ${SITE_NAME}`;
  const description =
    (product.description && product.description.trim().length > 40
      ? product.description
      : `${headline}${product.condition ? ` in ${product.condition.replace(/-/g, ' ')} condition` : ''}. Buy authentic pre-owned luxury fashion on ${SITE_NAME}.`
    ).slice(0, 300);

  const images = (product.images ?? []).map((i) => i.url).filter(Boolean).slice(0, 4);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
      images: images.length ? images.map((url) => ({ url })) : undefined,
    },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title,
      description,
      images: images.length ? images : undefined,
    },
  };
}

export default async function ProductLayout({ params, children }: Props) {
  const [product, reviews] = await Promise.all([
    fetchProductForSeo(params.id),
    fetchProductReviews(params.id),
  ]);

  if (!product?.title) return <>{children}</>;

  const url = absoluteUrl(`/products/${params.id}`);
  const images = (product.images ?? []).map((i) => i.url).filter(Boolean);

  // aggregateRating and review are only emitted when real reviews exist.
  // Google flags them as missing otherwise, but inventing ratings to silence
  // that warning breaches the structured data policy — the warning is
  // explicitly non-critical, a manual action is not.
  const ratingBlock =
    reviews.length > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(
              (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2)
            ),
            reviewCount: reviews.length,
            bestRating: 5,
            worstRating: 1,
          },
          review: reviews.slice(0, 10).map((r) => ({
            '@type': 'Review',
            reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            ...(r.content ? { reviewBody: r.content } : {}),
            ...(r.createdAt ? { datePublished: r.createdAt } : {}),
          })),
        }
      : {};

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.title,
    description: (product.description ?? '').slice(0, 5000),
    ...(images.length ? { image: images } : {}),
    sku: product.id,
    ...(product.brandId ? { brand: { '@type': 'Brand', name: product.brandId } } : {}),
    ...(product.color ? { color: product.color } : {}),
    ...(product.material ? { material: product.material } : {}),
    ...(product.size ? { size: product.size } : {}),
    ...ratingBlock,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: product.currency || 'EUR',
      price: typeof product.price === 'number' ? product.price : 0,
      availability:
        product.status === 'active'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition:
        CONDITION_URLS[product.condition ?? ''] ?? 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/home') },
      ...(product.categoryId
        ? [{
            '@type': 'ListItem',
            position: 2,
            name: product.categoryId,
            item: absoluteUrl(`/search?category=${encodeURIComponent(product.categoryId)}`),
          }]
        : []),
      { '@type': 'ListItem', position: product.categoryId ? 3 : 2, name: product.title },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {children}
    </>
  );
}
