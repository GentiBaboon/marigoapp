'use client';
import { useSellForm } from '@/components/sell/SellFormContext';
import { CategoryStep } from '@/components/sell/steps/CategoryStep';
import { DetailsStep } from '@/components/sell/steps/DetailsStep';
import { PhotosStep } from '@/components/sell/steps/PhotosStep';
import { DescriptionStep } from '@/components/sell/steps/DescriptionStep';
import { PricingStep } from '@/components/sell/steps/PricingStep';
import { ReviewStep } from '@/components/sell/steps/ReviewStep';
import { SuccessStep } from '@/components/sell/steps/SuccessStep';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Tag, User } from 'lucide-react';


export default function SellPage() {
  const { currentStep, totalSteps } = useSellForm();

  const stepComponents = [
    <CategoryStep key={1} />,
    <DetailsStep key={2} />,
    <PhotosStep key={3} />,
    <DescriptionStep key={4} />,
    <PricingStep key={5} />,
    <ReviewStep key={6} />,
    <SuccessStep key={7} />,
  ]

  return (
    <div className="space-y-12">
      {currentStep <= totalSteps && (
        <div className="text-left">
          <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground mb-2">
            Sell an item
          </h1>
          <p className="text-muted-foreground">
            Give your wardrobe a second life. List in minutes. Ship for free. Start earning effortlessly.
          </p>
        </div>
      )}
      
      <div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {stepComponents[currentStep - 1]}
          </motion.div>
        </AnimatePresence>
      </div>

       {currentStep === 1 && (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card>
                <CardContent className="p-6 flex items-start gap-4">
                    <Tag className="h-6 w-6 text-primary flex-shrink-0 mt-1"/>
                    <div>
                        <h3 className="font-semibold">How selling works</h3>
                        <p className="text-sm text-muted-foreground">From listing to shipping, we make it easy.</p>
                        <Link href="#" className="text-sm font-medium text-primary underline mt-1 inline-block">Learn more</Link>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-6 flex items-start gap-4">
                    <User className="h-6 w-6 text-primary flex-shrink-0 mt-1"/>
                    <div>
                        <h3 className="font-semibold">Professional sellers</h3>
                        <p className="text-sm text-muted-foreground">We have extra benefits for the pros.</p>
                        <Link href="#" className="text-sm font-medium text-primary underline mt-1 inline-block">Contact us</Link>
                    </div>
                </CardContent>
            </Card>
        </div>
       )}
    </div>
  );
}
