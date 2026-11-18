import Image from 'next/image';
import { Apple, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_STORE_WEB_URL, PLAY_STORE_URL } from '@/lib/app-download';

/**
 * Both store buttons. Phones rarely see this: middleware sends them straight
 * to their store (src/lib/app-download.ts). It is for desktops, iPads that
 * report themselves as a Mac, and anyone the user agent cannot place.
 */
export default function DownloadPage() {
  return (
    <section className="container flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Image
        src="/app-icon.png"
        alt="Marigo app icon"
        width={96}
        height={96}
        className="rounded-2xl shadow-md"
        priority
      />
      <div className="space-y-2">
        <h1 className="font-headline text-3xl md:text-4xl">Get the Marigo app</h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          Shop and sell preloved fashion from your phone. Free on iPhone and Android.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="flex-1">
          <a href={APP_STORE_WEB_URL} target="_blank" rel="noopener noreferrer">
            <Apple className="mr-2 h-5 w-5" aria-hidden />
            App Store
          </a>
        </Button>
        <Button asChild size="lg" variant="outline" className="flex-1">
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
            <Smartphone className="mr-2 h-5 w-5" aria-hidden />
            Google Play
          </a>
        </Button>
      </div>
    </section>
  );
}
