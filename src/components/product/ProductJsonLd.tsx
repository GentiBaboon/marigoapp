'use client';
import type { FirestoreProduct, FirestoreUser } from '@/lib/types';

interface ProductJsonLdProps {
    product: FirestoreProduct;
    seller: FirestoreUser | null;
}

export const ProductJsonLd = ({ product, seller }: ProductJsonLdProps) => {

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: product.description.substring(0, 5000), // Max length for description
        image: product.images?.[0] || '',
        sku: product.id,
        brand: {
            '@type': 'Brand',
            name: product.brand,
        },
        offers: {
            '@type': 'Offer',
            url: `https://www.marigo.app/products/${product.id}`,
            priceCurrency: 'EUR', // Prices are always stored in EUR
            price: product.price,
            availability: product.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
            seller: {
                '@type': 'Person',
                name: seller?.displayName || 'Marigo Seller',
            },
            itemCondition: `https://schema.org/${product.condition === 'new' ? 'NewCondition' : 'UsedCondition'}`,
        },
    };

    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [{
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://www.marigo.app/home"
      },{
        "@type": "ListItem",
        "position": 2,
        "name": product.category,
        "item": `https://www.marigo.app/search?category=${product.category}`
      },{
        "@type": "ListItem",
        "position": 3,
        "name": product.title
      }]
    };

    const organizationLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "MarigoApp",
      "url": "https://www.marigo.app",
      // User should provide a logo URL. I will assume one.
      "logo": "https://www.marigo.app/icons/icon-512x512.png" 
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
            />
             <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
            />
        </>
    );
};
