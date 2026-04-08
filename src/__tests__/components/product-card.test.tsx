import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// Mock WishlistContext
const mockAddToWishlist = vi.fn();
const mockRemoveFromWishlist = vi.fn();
vi.mock('@/context/WishlistContext', () => ({
  useWishlist: () => ({
    isFavorite: () => false,
    addToWishlist: mockAddToWishlist,
    removeFromWishlist: mockRemoveFromWishlist,
  }),
}));

// Mock CurrencyContext
vi.mock('@/context/CurrencyContext', () => ({
  useCurrency: () => ({
    formatPrice: (p: number) => `\u20AC${p.toFixed(2)}`,
  }),
}));

// Mock placeholder-images
vi.mock('@/lib/placeholder-images', () => ({
  PlaceHolderImages: [],
}));

import { ProductCard } from '@/components/product-card';

describe('ProductCard', () => {
  const baseProduct = {
    id: 'prod-1',
    title: 'Silk Dress',
    brandId: 'Gucci',
    price: 450,
    status: 'active' as const,
  };

  it('renders product title', () => {
    render(<ProductCard product={baseProduct} />);

    expect(screen.getByText('Silk Dress')).toBeInTheDocument();
  });

  it('renders brand name', () => {
    render(<ProductCard product={baseProduct} />);

    expect(screen.getByText('Gucci')).toBeInTheDocument();
  });

  it('renders price using formatPrice', () => {
    render(<ProductCard product={baseProduct} />);

    expect(screen.getByText('\u20AC450.00')).toBeInTheDocument();
  });

  it('renders "NO PHOTO" when no valid image URL', () => {
    render(<ProductCard product={baseProduct} />);

    expect(screen.getByText('NO PHOTO')).toBeInTheDocument();
  });

  it('renders image when valid HTTPS URL provided', () => {
    const productWithImage = {
      ...baseProduct,
      images: [{ url: 'https://example.com/photo.jpg', path: '' }],
    };

    render(<ProductCard product={productWithImage} />);

    const img = screen.getByAltText('Silk Dress');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(screen.queryByText('NO PHOTO')).not.toBeInTheDocument();
  });

  it('renders VINTAGE badge when product.vintage is true', () => {
    const vintageProduct = { ...baseProduct, vintage: true };
    render(<ProductCard product={vintageProduct} />);

    expect(screen.getByText('VINTAGE')).toBeInTheDocument();
  });

  it('does not render VINTAGE badge when vintage is false', () => {
    const nonVintageProduct = { ...baseProduct, vintage: false };
    render(<ProductCard product={nonVintageProduct} />);

    expect(screen.queryByText('VINTAGE')).not.toBeInTheDocument();
  });

  it('renders "Untitled Product" when title is missing', () => {
    const noTitle = { id: 'prod-2', price: 100 };
    render(<ProductCard product={noTitle} />);

    expect(screen.getByText('Untitled Product')).toBeInTheDocument();
  });

  it('renders "Luxury Item" when no brand info provided', () => {
    const noBrand = { id: 'prod-3', title: 'Some Item', price: 99 };
    render(<ProductCard product={noBrand} />);

    expect(screen.getByText('Luxury Item')).toBeInTheDocument();
  });

  it('renders "Contact for price" when price is missing', () => {
    const noPrice = { id: 'prod-4', title: 'Rare Bag' };
    render(<ProductCard product={noPrice} />);

    expect(screen.getByText('Contact for price')).toBeInTheDocument();
  });

  it('links to the product detail page', () => {
    render(<ProductCard product={baseProduct} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/products/prod-1');
  });
});
