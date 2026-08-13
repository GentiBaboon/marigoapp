'use client';
import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreProduct } from '@/lib/types';
import { ListingItem } from '@/components/profile/listing-item';
import { useSellForm } from '@/components/sell/SellFormContext';
import { SellProgressHeader } from '@/components/sell/SellProgressHeader';
import { PhotosStep } from '@/components/sell/steps/PhotosStep';
import { CategoryStep } from '@/components/sell/steps/CategoryStep';
import { DescriptionStep } from '@/components/sell/steps/DescriptionStep';
import { DetailsStep } from '@/components/sell/steps/DetailsStep';
import { PricingStep } from '@/components/sell/steps/PricingStep';
import { ReviewStep } from '@/components/sell/steps/ReviewStep';
import { SuccessStep } from '@/components/sell/steps/SuccessStep';
import { ListingModeStep } from '@/components/sell/steps/ListingModeStep';
import { AiListingAssistant } from '@/components/sell/AiListingAssistant';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Tag, History, Trash2, ChevronRight, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

/** Where a listing is started from, before a draft exists. */
type Entry = 'idle' | 'choosing' | 'assistant';

export default function SellPage() {
  const { activeDraft, drafts, startNewDraft, selectDraft, deleteDraft, currentStep, totalSteps } = useSellForm();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [entry, setEntry] = React.useState<Entry>('idle');

  // Listings already saved to Firestore. These are distinct from `drafts`
  // above, which is unfinished wizard state kept in localStorage on this
  // device only — a submitted listing never appears there.
  const listingsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'products'),
      where('sellerId', '==', user.uid),
      orderBy('listingCreated', 'desc')
    );
  }, [user, firestore]);
  const { data: listings } = useCollection<FirestoreProduct>(listingsQuery);

  const unpublished = React.useMemo(
    () => (listings || []).filter(l => l.status === 'draft' || l.status === 'pending_review'),
    [listings]
  );

  // The assistant runs before any draft exists — it is what produces one.
  if (!activeDraft && entry === 'assistant') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <AiListingAssistant
          onBack={() => setEntry('choosing')}
          onDrafted={(formData, note) => {
            // Straight to Review (step 6): everything the assistant could infer
            // is filled, and the seller's job now is to check it, not retype it.
            startNewDraft({ formData, step: 6 });
            setEntry('idle');
            toast({
              title: 'Draft ready to review',
              description: note || 'Check the details and publish when you are happy.',
            });
          }}
        />
      </div>
    );
  }

  if (!activeDraft && entry === 'choosing') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <ListingModeStep
          onManual={() => {
            startNewDraft();
            setEntry('idle');
          }}
          onAssisted={() => setEntry('assistant')}
        />
      </div>
    );
  }

  if (!activeDraft) {
    return (
      <div className="container mx-auto max-w-2xl py-12 px-4 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-headline">Sell on Marigo</h1>
          <p className="text-muted-foreground text-sm">Give your luxury items a new life in just a few steps.</p>
        </div>

        <Button
          className="w-full h-16 text-lg gap-3 bg-black text-white hover:bg-black/90 shadow-lg"
          onClick={() => setEntry('choosing')}
        >
          <Plus className="h-6 w-6" />
          List a New Item
        </Button>

        {drafts.length > 0 && (
          <div className="space-y-4 pt-4">
            <h3 className="font-bold flex items-center gap-2 text-muted-foreground uppercase text-xs tracking-widest">
              <History className="h-4 w-4" />
              Unfinished on this device
            </h3>
            <div className="grid gap-3">
              {drafts.map(draft => (
                <div key={draft.id} className="group relative">
                    <Card 
                        className="cursor-pointer hover:border-primary transition-all active:scale-[0.98]" 
                        onClick={() => selectDraft(draft.id)}
                    >
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-primary/5 rounded-lg flex items-center justify-center border border-primary/10">
                                    <Tag className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <p className="font-bold">{draft.formData.brandId || 'Untitled Item'}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                                        Last modified {new Date(draft.lastModified).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs font-semibold text-primary uppercase">Step {draft.currentStep}/{totalSteps}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                        </CardContent>
                    </Card>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteDraft(draft.id);
                        }}
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {unpublished.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-muted-foreground uppercase text-xs tracking-widest">
                <Clock className="h-4 w-4" />
                Submitted — not yet live ({unpublished.length})
              </h3>
              <Link
                href="/profile/listings?tab=inactive"
                className="text-xs text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="space-y-4">
              {unpublished.map(product => (
                <ListingItem key={product.id} product={product} />
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
      case 2: return <CategoryStep />;
      case 3: return <DescriptionStep />;
      case 4: return <DetailsStep />;
      case 5: return <PricingStep />;
      case 6: return <ReviewStep />;
      case 7: return <SuccessStep />;
      default: return <PhotosStep />;
    }
  };

  const showHeader = currentStep <= 6;

  return (
    <div className="min-h-screen bg-background">
      {showHeader && <SellProgressHeader />}
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
