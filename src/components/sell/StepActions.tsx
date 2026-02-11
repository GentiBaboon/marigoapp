'use client';
import { Button } from '@/components/ui/button';
import { useSellForm } from './SellFormContext';
import { Loader2 } from 'lucide-react';

interface StepActionsProps {
  onNext?: () => void;
  onBack?: () => void;
  nextText?: string;
  backText?: string;
  isNextLoading?: boolean;
  isNextDisabled?: boolean;
  hideBack?: boolean;
}

export function StepActions({
  onNext,
  onBack,
  nextText = 'Continue',
  backText = 'Back',
  isNextLoading = false,
  isNextDisabled = false,
  hideBack = false,
}: StepActionsProps) {
  const { prevStep, nextStep } = useSellForm();

  const handleBack = onBack || prevStep;
  const handleNext = onNext || nextStep;

  return (
    <div className="flex flex-col-reverse sm:flex-row gap-4 mt-8">
      {!hideBack && (
        <Button variant="outline" onClick={handleBack} className="w-full">
          {backText}
        </Button>
      )}
      <Button onClick={handleNext} disabled={isNextLoading || isNextDisabled} className="w-full">
        {isNextLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {nextText}
      </Button>
    </div>
  );
}
