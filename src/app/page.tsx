'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
        <h1 className="inline-block font-logo font-bold text-6xl bg-gradient-to-r from-primary to-purple-400 text-transparent bg-clip-text">
          marigo
        </h1>
        <div className="dot-flashing"></div>
      </div>
    </div>
  );
}
