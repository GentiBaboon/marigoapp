'use client';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const timelineSteps = [
  { id: 'processing', title: 'Processing' },
  { id: 'shipped', title: 'Shipped' },
  { id: 'delivered', title: 'Delivered' },
];

export function OrderTimeline({ status }: { status: string }) {
    const currentStepIndex = timelineSteps.findIndex(step => step.id === status);

  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {timelineSteps.map((step, stepIdx) => (
          <li
            key={step.title}
            className={cn(
              'relative flex-1',
              stepIdx !== timelineSteps.length - 1 ? 'pr-8 sm:pr-12' : ''
            )}
          >
            {stepIdx < currentStepIndex ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-primary" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                  <Check className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                </div>
                 <span className="absolute -bottom-7 -ml-2 text-sm font-medium text-primary">
                  {step.title}
                </span>
              </>
            ) : stepIdx === currentStepIndex ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-200" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                </div>
                 <span className="absolute -bottom-7 -ml-2 text-sm font-medium text-primary">
                  {step.title}
                </span>
              </>
            ) : (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-200" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-background" />
                <span className="absolute -bottom-7 -ml-2 text-sm font-medium text-muted-foreground">
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
