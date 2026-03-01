'use client';
import { useSellForm } from './SellFormContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronLeft, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SellProgressHeader() {
  const { currentStep, totalSteps, prevStep } = useSellForm();
  const router = useRouter();
  const progress = (currentStep / totalSteps) * 100;

  const stepTitles = [
    "Photos",
    "Category & Brand",
    "Details",
    "Condition",
    "Pricing",
    "Preview"
  ];

  return (
    <div className="sticky top-16 bg-background z-30 pt-4 pb-2 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={currentStep > 1 ? prevStep : () => router.push('/sell')}>
          {currentStep > 1 ? <ChevronLeft className="h-6 w-6" /> : <X className="h-6 w-6" />}
        </Button>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Step {currentStep} of {totalSteps}</p>
          <h1 className="font-semibold text-sm">{stepTitles[currentStep - 1]}</h1>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>
      <Progress value={progress} className="h-1 rounded-none" />
    </div>
  );
}
