'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    // For this new flow, we always go to the home page.
    // The shopping preference popup will be handled there.
    router.replace('/home');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-8">
        {/* The artwork is already the brand purple, so it needs no tint —
            unlike the header's copy, which is blackened with `brightness-0`. */}
        <Image
          src="/logo.png"
          alt="Marigo"
          width={2000}
          height={535}
          priority
          // Without `sizes`, Next builds a srcset from the 2000px intrinsic
          // width and the browser picks the 3840px candidate for a 224px slot —
          // a megabyte of wordmark on the very first paint.
          sizes="(min-width: 640px) 256px, 224px"
          className="h-auto w-56 sm:w-64"
        />
        <div className="dot-flashing"></div>
      </div>
    </div>
  );
}
