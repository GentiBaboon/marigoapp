'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

type Step = {
  number: number;
  title: string;
};

const steps: Step[] = [
  { number: 1, title: 'Address' },
  { number: 2, title: 'Payment' },
  { number: 3, title: 'Review' },
];

export function CheckoutSteps({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Progress">
      <ol
        role="list"
        className="flex items-center"
      >
        {steps.map((step, stepIdx) => (
          <li
            key={step.title}
            className={cn(
              'relative flex-1',
              stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''
            )}
          >
            {step.number < currentStep ? (
              <>
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <div className="h-0.5 w-full bg-primary" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-5 w-5" />
                </div>
              </>
            ) : step.number === currentStep ? (
              <>
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <div className="h-0.5 w-full bg-gray-200" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background">
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                </div>
                <span className="absolute top-10 -ml-2 text-sm font-medium text-primary">
                  {step.title}
                </span>
              </>
            ) : (
              <>
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <div className="h-0.5 w-full bg-gray-200" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-background" />
                 <span className="absolute top-10 -ml-2 text-sm font-medium text-muted-foreground">
                  {step.title}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
