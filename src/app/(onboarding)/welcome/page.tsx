'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function WelcomePage() {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);
  const router = useRouter();

  const slides = [
    {
      id: 'welcome-1',
      title: 'Discover Luxury',
      description: 'Explore a curated selection of authentic luxury fashion.',
    },
    {
      id: 'welcome-2',
      title: 'Buy & Sell with Ease',
      description: 'Your trusted marketplace for pre-loved treasures.',
    },
    {
      id: 'welcome-3',
      title: 'Join the Community',
      description: 'Connect with fashion lovers across Albania and Europe.',
    },
  ];

  React.useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on('select', () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  const handleGetStarted = () => {
    localStorage.setItem('marigo_onboarding_complete', 'true');
    router.push('/home');
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center text-center space-y-8">
      <Carousel setApi={setApi} className="w-full">
        <CarouselContent>
          {slides.map((slide, index) => {
            const imageData = PlaceHolderImages.find((p) => p.id === slide.id);
            return (
              <CarouselItem key={index}>
                <div className="p-1">
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center p-6 aspect-square space-y-4">
                      {imageData && (
                        <Image
                          src={imageData.imageUrl}
                          width={300}
                          height={300}
                          data-ai-hint={imageData.imageHint}
                          alt={imageData.description}
                          className="rounded-lg object-cover w-48 h-48"
                        />
                      )}
                      <h3 className="font-headline text-2xl font-bold">
                        {slide.title}
                      </h3>
                      <p className="text-muted-foreground">
                        {slide.description}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>

      <div className="flex items-center space-x-2">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full transition-colors ${
              index + 1 === current ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {current === count && (
        <Button
          size="lg"
          className="w-full max-w-xs animate-in fade-in duration-500"
          onClick={handleGetStarted}
        >
          Get Started
        </Button>
      )}
    </div>
  );
}
