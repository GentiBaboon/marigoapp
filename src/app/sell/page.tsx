'use client';
import { useSellForm } from '@/components/sell/SellFormContext';
import { SellProgressHeader } from '@/components/sell/SellProgressHeader';
import { PhotosStep } from '@/components/sell/steps/PhotosStep';
import { PricingStep } from '@/components/sell/steps/PricingStep';
import { ReviewStep } from '@/components/sell/steps/ReviewStep';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Tag, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SellPage() {
  const { activeDraft, drafts, startNewDraft, selectDraft, currentStep } = useSellForm();

  if (!activeDraft) {
    return (
      <div className="container mx-auto max-w-2xl py-12 px-4 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold font-headline">Sell on Marigo</h1>
          <p className="text-muted-foreground text-lg">Turn your luxury items into cash in 6 easy steps.</p>
        </div>

        <Button className="w-full h-20 text-xl gap-4 bg-black hover:bg-black/90" onClick={startNewDraft}>
          <Plus className="h-8 w-8" />
          Start New Listing
        </Button>

        {drafts.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <History className="h-5 w-5" />
              Continue from draft
            </h3>
            <div className="grid gap-4">
              {drafts.map(draft => (
                <Card key={draft.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => selectDraft(draft.id)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-muted rounded flex items-center justify-center">
                        <Tag className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-bold">{draft.formData.brand || 'Untitled Draft'}</p>
                        <p className="text-xs text-muted-foreground">Last modified {new Date(draft.lastModified).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">Step {draft.currentStep} of 6</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <PhotosStep />;
      case 5: return <PricingStep />;
      case 6: return <ReviewStep />;
      // Steps 2,3,4 would be implemented similarly
      default: return (
        <div className="text-center py-20 space-y-4">
          <h2 className="text-xl font-bold">Step {currentStep} coming soon</h2>
          <Button onClick={() => useSellForm().nextStep()}>Skip to next step</Button>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SellProgressHeader />
      <main className="container mx-auto max-w-xl px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
