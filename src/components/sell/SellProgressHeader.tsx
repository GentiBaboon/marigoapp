'use client';
import { useSellForm } from './SellFormContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronLeft, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SellProgressHeader() {
  const { currentStep, totalSteps, prevStep, goToStep, deselectDraft } = useSellForm();
  const router = useRouter();
  const progress = (currentStep / totalSteps) * 100;

  const stepTitles = [
    "Photos",
    "Category & Brand",
    "Details",
    "Item Specifics",
    "Pricing & Shipping",
    "Preview"
  ];

  const handleClose = () => {
    // Step 1's X icon closes the wizard and returns to the Sell home page
    // (with the drafts list + "List a New Item" button). Deselect the active
    // draft so /sell renders its landing view instead of resuming the wizard.
    // The draft itself is preserved and stays in the pending drafts list.
    deselectDraft();
    router.push('/sell');
  };

  return (
    <div className="sticky top-16 bg-background z-30 pt-4 pb-2 space-y-4">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" onClick={currentStep > 1 ? prevStep : handleClose}>
          {currentStep > 1 ? <ChevronLeft className="h-6 w-6" /> : <X className="h-6 w-6" />}
        </Button>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Step {currentStep} of {totalSteps}</p>
          <h1 className="font-semibold text-xs">{stepTitles[currentStep - 1] || 'Listing'}</h1>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>
      <Progress value={progress} className="h-1 rounded-none" />
    </div>
  );
}
