'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { vintageGems } from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ArrowRight } from 'lucide-react';
import { NewListingsSection } from '@/components/home/NewArrivalsSection';
import { RecentlyViewedSection } from '@/components/home/RecentlyViewedSection';

export default function HomePage() {
  return (
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
        <RecentlyViewedSection />

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
  );
}
