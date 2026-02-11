'use client';
import { useSellForm } from './SellFormContext';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { categories } from '@/lib/mock-data';

export function SellProgressHeader() {
  const { formData, currentStep, totalSteps } = useSellForm();
  
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  const getCategoryName = (slug: string | undefined) => {
    if (!slug) return '';
    return categories.find(c => c.slug === slug)?.name || '';
  }

  const getGenderName = (gender: string | undefined) => {
    if (!gender) return '';
    return gender.charAt(0).toUpperCase() + gender.slice(1);
  }

  return (
    <div className="text-center space-y-4">
        <div>
            <h2 className="font-semibold text-lg">{formData.brand}</h2>
            <p className="text-muted-foreground">{`${getGenderName(formData.gender)}, ${getCategoryName(formData.category)}`}</p>
        </div>
        <div className="flex justify-center items-center gap-4">
            {steps.map(step => {
                const isCompleted = currentStep > step;
                const isActive = currentStep === step;
                return (
                    <div key={step} className="flex flex-col items-center gap-2">
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center border-2 font-semibold",
                            isActive && "bg-black border-black text-white",
                            isCompleted && "bg-white border-black text-black",
                            !isActive && !isCompleted && "bg-white border-gray-300 text-gray-400"
                        )}>
                           {isCompleted ? <Check className="h-5 w-5" /> : step}
                        </div>
                    </div>
                )
            })}
        </div>
    </div>
  );
}
