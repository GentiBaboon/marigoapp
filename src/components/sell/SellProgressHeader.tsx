'use client';
import { useSellForm } from './SellFormContext';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { productCategories } from '@/lib/mock-data';

export function SellProgressHeader() {
  const { formData, currentStep, totalSteps } = useSellForm();

  const visualSteps = Array.from({ length: 6 }, (_, i) => i + 1);

  const getCategoryName = (slug: string | undefined) => {
    if (!slug) return '';
    for (const mainCategory of productCategories) {
      const sub = mainCategory.subcategories.find(s => s.slug === slug);
      if (sub) return sub.name;
    }
    return slug;
  }

  const getGenderName = (gender: string | undefined) => {
    if (!gender) return '';
    return gender.charAt(0).toUpperCase() + gender.slice(1);
  }

  const stepLabels: { [key: number]: string } = {
    1: 'Category',
    2: 'Details',
    3: 'Photos',
    4: 'Description',
    5: 'Address',
    6: 'Price',
  };

  return (
    <div className="text-center space-y-4">
        <div>
            <h2 className="font-semibold text-lg">{formData.brand}</h2>
            <p className="text-muted-foreground">{`${getGenderName(formData.gender)}, ${getCategoryName(formData.category)}`}</p>
        </div>
        <div className="flex justify-center items-center gap-4">
            {visualSteps.map(step => {
                const isCompleted = currentStep > step;
                const isActive = currentStep === step;
                return (
                    <div key={step} className="flex flex-col items-center gap-2 relative">
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center border-2 font-semibold transition-all",
                            isActive && "bg-black border-black text-white scale-110",
                            isCompleted && "bg-white border-black text-black",
                            !isActive && !isCompleted && "bg-white border-gray-300 text-gray-400"
                        )}>
                           {isCompleted ? <Check className="h-5 w-5" /> : step}
                        </div>
                        {isActive && (
                            <span className="text-xs font-semibold absolute -bottom-5">{stepLabels[step]}</span>
                        )}
                    </div>
                )
            })}
        </div>
    </div>
  );
}
