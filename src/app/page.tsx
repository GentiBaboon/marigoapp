'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      // Check if onboarding is complete
      const onboardingComplete = localStorage.getItem('marigo_onboarding_complete');
      if (onboardingComplete === 'true') {
        router.replace('/home');
      } else {
        router.replace('/language');
      }
    }, 3000); // 3-second splash screen

    return () => clearTimeout(timer);
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
