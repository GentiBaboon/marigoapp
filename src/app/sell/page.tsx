'use client';
import { useEffect, useState } from 'react';
import { useSellForm } from '@/components/sell/SellFormContext';
import { CategoryStep } from '@/components/sell/steps/CategoryStep';
import { DetailsStep } from '@/components/sell/steps/DetailsStep';
import { PhotosStep } from '@/components/sell/steps/PhotosStep';
import { DescriptionStep } from '@/components/sell/steps/DescriptionStep';
import { AddressStep } from '@/components/sell/steps/AddressStep';
import { PricingStep } from '@/components/sell/steps/PricingStep';
import { ReviewStep } from '@/components/sell/steps/ReviewStep';
import { SuccessStep } from '@/components/sell/steps/SuccessStep';
import { AnimatePresence, motion } from 'framer-motion';
import { SellProgressHeader } from '@/components/sell/SellProgressHeader';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SellDraft } from '@/lib/types';
import Image from 'next/image';
import { productCategories } from '@/lib/mock-data';
import { useI18n } from '@/hooks/use-i18n';

const getCategoryName = (gender: string, categorySlug: string) => {
    const genderName = gender ? `${gender.charAt(0).toUpperCase()}${gender.slice(1)}'s` : '';
    
    for (const mainCategory of productCategories) {
        const sub = mainCategory.subcategories.find(s => s.slug === categorySlug);
        if (sub) {
            return `${genderName} ${sub.name}`;
        }
    }
    return `${genderName}`;
}

const DraftItem = ({ draft, onSelect, onDelete, totalSteps }: { draft: SellDraft, onSelect: () => void, onDelete: () => void, totalSteps: number }) => {
    const { t } = useI18n();
    const { formData, currentStep } = draft;
    const stepsRemaining = totalSteps - currentStep + 1;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative h-24 w-24 flex-shrink-0 bg-muted rounded-md flex items-center justify-center">
                    {formData.images && formData.images.length > 0 ? (
                        <Image
                            src={formData.images[0].preview}
                            alt={formData.title || 'Draft image'}
                            fill
                            sizes="96px"
                            className="object-cover rounded-md"
                        />
                    ) : (
                        <span className="font-bold text-4xl text-muted-foreground">V.</span>
                    )}
                </div>
                <div className="flex-1">
                    <p className="font-bold text-lg">{formData.brand || 'Untitled'}</p>
                    <p className="text-muted-foreground">{getCategoryName(formData.gender || '', formData.category || '')}</p>
                    <p className="text-sm text-muted-foreground">{t('Sell.stepsRemaining', { count: stepsRemaining })}</p>
                </div>
            </div>
            <div className="flex items-center justify-end gap-4">
                <Button variant="ghost" onClick={onDelete}>{t('Common.delete')}</Button>
                <Button variant="outline" onClick={onSelect}>{t('Sell.finishListing')}</Button>
            </div>
             <Separator />
        </div>
    )
}

export default function SellPage() {
  const { drafts, activeDraft, startNewDraft, selectDraft, deleteDraft, currentStep, totalSteps } = useSellForm();
  const { t } = useI18n();
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const handleStartNew = () => {
    startNewDraft();
  }

  const handleSelectDraft = (draftId: string) => {
    selectDraft(draftId);
  }

  const stepComponents = [
    <CategoryStep key={1} />,
    <DetailsStep key={2} />,
    <PhotosStep key={3} />,
    <DescriptionStep key={4} />,
    <AddressStep key={5} />,
    <PricingStep key={6} />,
    <ReviewStep key={7} />,
    <SuccessStep key={8} />,
  ]

  if (!isClient) {
      // Render nothing or a skeleton loader on the server
      return null;
  }

  if (!activeDraft) {
    return (
      <div className="space-y-8">
        <div className="text-left">
          <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground mb-2">
            {t('Sell.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('Sell.description')}
          </p>
        </div>
        <Button className="w-full bg-foreground text-background hover:bg-foreground/90" size="lg" onClick={handleStartNew}>
          {t('Sell.startListing')}
        </Button>
        
        {drafts.length > 0 && (
            <div className="space-y-6">
                <div className="relative pt-4">
                    <div className="absolute inset-0 flex items-center">
                        <Separator />
                    </div>
                    <div className="relative flex justify-start">
                        <span className="bg-background pr-3 text-sm font-medium text-muted-foreground">
                            {t('Sell.listingDrafts')}
                        </span>
                    </div>
                </div>
                {drafts.map(draft => (
                    <DraftItem 
                        key={draft.id} 
                        draft={draft} 
                        onSelect={() => handleSelectDraft(draft.id)}
                        onDelete={() => deleteDraft(draft.id)}
                        totalSteps={totalSteps}
                    />
                ))}
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {currentStep > 1 && currentStep <= totalSteps && <SellProgressHeader />}
      
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
    </div>
  );
}
    