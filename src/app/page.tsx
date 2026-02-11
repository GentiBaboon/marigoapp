import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const heroImage = PlaceHolderImages.find((p) => p.id === 'home-hero');

  return (
    <div className="container mx-auto px-4">
      <section className="grid lg:grid-cols-2 place-items-center py-20 md:py-32 gap-10">
        <div className="text-center lg:text-start space-y-6">
          <main className="text-5xl md:text-6xl font-bold font-headline">
            <h1 className="inline">
              Discover
              <span className="inline bg-gradient-to-r from-primary to-purple-400 text-transparent bg-clip-text">
                {' '}
                Luxury{' '}
              </span>
              Fashion,
            </h1>{' '}
            Reimagined.
          </main>

          <p className="text-xl text-muted-foreground md:w-10/12 mx-auto lg:mx-0">
            The premier C2C marketplace for luxury fashion in Albania and the
            EU. Buy, sell, and discover unique pieces.
          </p>

          <div className="space-y-4 md:space-y-0 md:space-x-4">
            <Button asChild className="w-full md:w-auto" size="lg">
              <Link href="/browse">Shop Now</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full md:w-auto"
              size="lg"
            >
              <Link href="/sell">Sell an Item</Link>
            </Button>
          </div>
        </div>

        {heroImage && (
          <div className="hidden lg:block">
            <div className="shadow-2xl rounded-lg overflow-hidden border">
              <Image
                src={heroImage.imageUrl}
                data-ai-hint={heroImage.imageHint}
                width={600}
                height={400}
                alt={heroImage.description}
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
