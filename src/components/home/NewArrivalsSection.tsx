'use client';

import { ProductCard } from '@/components/product-card';
import { newArrivals } from '@/lib/mock-data';

export function NewArrivalsSection() {
  return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
      </div>
  );
}
