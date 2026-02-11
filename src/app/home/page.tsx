import Link from 'next/link';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product-card';
import {
  categories,
  trendingProducts,
  outletProducts,
} from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { NewArrivalsSection } from '@/components/home/NewArrivalsSection';

export default function HomePage() {
  const bannerImages = PlaceHolderImages.filter((p) =>
    p.id.startsWith('banner-')
  );

  return (
    <div className="flex flex-col">
      <section className="w-full">
        <Carousel
          opts={{
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent>
            {bannerImages.map((image) => (
              <CarouselItem key={image.id}>
                <div className="relative h-64 md:h-[500px] w-full">
                  <Image
                    src={image.imageUrl}
                    alt={image.description}
                    data-ai-hint={image.imageHint}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="absolute left-4 hidden md:flex" />
          <CarouselNext className="absolute right-4 hidden md:flex" />
        </Carousel>
      </section>

      <div className="container mx-auto px-4 py-8 md:py-12">
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-headline font-bold mb-6 text-center">
            Shop by Category
          </h2>
          <div className="relative">
            <div className="flex space-x-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex-shrink-0 w-2 md:w-0"></div>
              {categories.map((category) => (
                <Button
                  asChild
                  variant="outline"
                  key={category.id}
                  className="flex-shrink-0 rounded-full"
                  size="lg"
                >
                  <Link href={`/browse?category=${category.slug}`}>
                    {category.name}
                  </Link>
                </Button>
              ))}
              <div className="flex-shrink-0 w-2 md:w-0"></div>
            </div>
            <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none"></div>
            <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none"></div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-headline font-bold mb-6">
            New Arrivals
          </h2>
          <NewArrivalsSection />
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-headline font-bold mb-6">
            Trending Now
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {trendingProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        <section>
          <div className="bg-muted/50 rounded-lg p-6 md:p-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary">
                The Outlet
              </h2>
              <p className="text-muted-foreground mt-2">
                Unbeatable prices on last season's treasures. Up to 70% off.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {outletProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="text-center mt-8">
              <Button asChild size="lg">
                <Link href="/browse?section=outlet">Shop All Outlet</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
