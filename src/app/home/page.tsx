import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product-card';
import { shopByCategory, trendingProducts } from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function HomePage() {
  return (
    <div className="flex flex-col bg-background">
      <Alert className="w-full text-center rounded-none border-x-0 border-t-0 bg-amber-100 border-amber-200 text-amber-900">
        <div className="container mx-auto flex items-center justify-center p-2 relative">
          <div>
            <AlertTitle className="font-bold">You've Earned 20% Off</AlertTitle>
            <AlertDescription className="text-sm">
              Save on orders 100€+ as a gift for selling with us. Code: FIRSTVC
            </AlertDescription>
          </div>
          <Info className="h-4 w-4 absolute right-4 top-1/2 -translate-y-1/2" />
        </div>
      </Alert>

      <div className="container mx-auto px-4 py-8 md:py-12 space-y-12">
        <section>
          <h2 className="text-xl md:text-2xl font-serif mb-6">
            Shop by Category
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {shopByCategory.map((category) => {
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
                        sizes="(max-width: 768px) 50vw, 25vw"
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

        <section>
          <h2 className="text-xl md:text-2xl font-serif mb-6">
            Now Trending
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8">
            {trendingProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="text-center mt-8">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full px-12"
            >
              <Link href="/browse?section=trending">View all</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

    