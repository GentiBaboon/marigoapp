'use client';
import { useSellForm } from '@/components/sell/SellFormContext';
import { Progress } from '@/components/ui/progress';

export function SellFormProgress() {
  const { currentStep, totalSteps } = useSellForm();
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-3">
      <Progress value={progressPercentage} className="h-2" />
      <p className="text-sm text-muted-foreground text-center">
        Step {currentStep} of {totalSteps}
      </p>
    </div>
  );
}
