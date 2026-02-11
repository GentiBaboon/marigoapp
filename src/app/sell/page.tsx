'use client';
import { useSellForm } from '@/components/sell/SellFormContext';
import { SellFormProgress } from '@/components/sell/SellFormProgress';
import { CategoryStep } from '@/components/sell/steps/CategoryStep';
import { DetailsStep } from '@/components/sell/steps/DetailsStep';
import { PhotosStep } from '@/components/sell/steps/PhotosStep';
import { DescriptionStep } from '@/components/sell/steps/DescriptionStep';
import { PricingStep } from '@/components/sell/steps/PricingStep';
import { ReviewStep } from '@/components/sell/steps/ReviewStep';
import { SuccessStep } from '@/components/sell/steps/SuccessStep';
import { AnimatePresence, motion } from 'framer-motion';

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
    <div>
      {currentStep <= totalSteps && (
        <div className="text-center mb-10">
          <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Sell Your Luxury Item
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            In just a few steps, your item will be ready for thousands of buyers.
          </p>
        </div>
      )}

      {currentStep <= totalSteps && <SellFormProgress />}
      
      <div className="mt-8">
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
    </div>
  );
}
