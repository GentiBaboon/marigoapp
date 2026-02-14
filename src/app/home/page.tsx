'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
        <NewListingsSection />
      </div>
    </div>
  );
}
