'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product-card';
import {
  recentlyViewedProducts,
  vintageGems,
} from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ArrowRight } from 'lucide-react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { NewListingsSection } from '@/components/home/NewArrivalsSection';

export default function HomePage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (isUserLoading || user) return;

    const handleScroll = () => {
      setScrolled(true);
      window.removeEventListener('scroll', handleScroll);
    };
    window.addEventListener('scroll', handleScroll, { once: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isUserLoading, user]);

  const handleClick = () => {
    if (scrolled && !user && !isUserLoading) {
      router.push('/auth');
    }
  };

  const shouldShowOverlay = scrolled && !user && !isUserLoading;

  return (
    <div className="relative" onClick={handleClick}>
      <div className="flex flex-col bg-background">
        <div className="bg-background border-b">
          <div className="container mx-auto px-4 py-6">
            <h2 className="text-2xl font-serif mb-2">First Time?</h2>
            <p className="text-muted-foreground">Shop: 15% off with code <span className="font-semibold text-foreground">WELCOME15</span>. Sell: No fees to start.*...</p>
            <Link href="#" className="flex items-center mt-2 font-semibold text-sm group text-primary">
              Get started
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 md:py-12 space-y-12">
          <section>
            <h2 className="text-xl md:text-2xl font-serif mb-6">
              Recently Viewed
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8">
              {recentlyViewedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-serif mb-6">
              Vintage Gems
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {vintageGems.map((category) => {
                const imageData = PlaceHolderImages.find(
                  (p) => p.id === category.image
                );
                return (
                  <Link
                    href={`/browse?category=${category.slug}`}
                    key={category.id}
                    className="group text-center"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-muted mb-2">
                      {imageData && (
                        <Image
                          src={imageData.imageUrl}
                          alt={category.name}
                          fill
                          sizes="(max-width: 768px) 33vw, 33vw"
                          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                          data-ai-hint={imageData.imageHint}
                        />
                      )}
                    </div>
                    <p className="font-semibold uppercase tracking-wider text-xs">
                      {category.name}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          <NewListingsSection />
        </div>
      </div>
       {shouldShowOverlay && (
        <div className="absolute inset-0 z-30 bg-transparent" />
      )}
    </div>
  );
}
