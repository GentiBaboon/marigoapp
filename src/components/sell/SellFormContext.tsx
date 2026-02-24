'use client';

import React, { useState, createContext, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import type { SellFormValues, SellDraft } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, collection } from 'firebase/firestore';

interface SellFormContextType {
  drafts: SellDraft[];
  activeDraft: SellDraft | undefined;
  startNewDraft: () => void;
  selectDraft: (draftId: string) => void;
  deleteDraft: (draftId: string) => void;
  unselectDraft: () => void;
  setFormData: (data: Partial<SellFormValues>) => void;
  currentStep: number;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  deleteActiveDraft: () => void;
  totalSteps: number;
  formData: Partial<SellFormValues>;
}

const SellFormContext = createContext<SellFormContextType | undefined>(undefined);

export const SellFormProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [drafts, setDrafts] = useState<SellDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const totalSteps = 7;
  const firestore = useFirestore();

  // Load drafts from localStorage on initial mount
  useEffect(() => {
    try {
      const savedDrafts = localStorage.getItem('sell_form_drafts');
      if (savedDrafts) {
        setDrafts(JSON.parse(savedDrafts));
      }
    } catch (error) {
      console.error("Failed to load drafts from localStorage", error);
      localStorage.removeItem('sell_form_drafts');
    }
    setIsInitialized(true);
  }, []);

  // Save drafts to localStorage whenever the drafts array changes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      // Create a savable version of drafts without large data URLs
      const savableDrafts = drafts.map(draft => {
        const { images, proofOfOrigin, ...restOfFormData } = draft.formData;
        return {
          ...draft,
          formData: restOfFormData,
        };
      });

      if (savableDrafts.length > 0) {
        localStorage.setItem('sell_form_drafts', JSON.stringify(savableDrafts));
      } else {
        localStorage.removeItem('sell_form_drafts');
      }
    } catch (error) {
      console.error("Failed to save drafts to localStorage.", error);
    }
  }, [drafts, isInitialized]);

  const activeDraft = useMemo(() => drafts.find(d => d.id === activeDraftId), [drafts, activeDraftId]);
  
  const setFormData = useCallback((newData: Partial<SellFormValues>) => {
    if (!activeDraftId) return;
    setDrafts(prevDrafts =>
        prevDrafts.map(d =>
            d.id === activeDraftId
            ? { ...d, formData: { ...d.formData, ...newData }, lastModified: Date.now() }
            : d
        )
    );
  }, [activeDraftId]);
  
  const startNewDraft = useCallback(() => {
    if (!firestore) return;
    const newProductId = doc(collection(firestore, 'products')).id;
    const newDraftId = `draft_${Date.now()}`;
    const newDraft: SellDraft = {
        id: newDraftId,
        formData: {
            productId: newProductId
        },
        currentStep: 1,
        lastModified: Date.now(),
    };
    setDrafts(prev => [...prev, newDraft]);
    setActiveDraftId(newDraftId);
  }, [firestore]);

  const selectDraft = useCallback((draftId: string) => {
      setActiveDraftId(draftId);
  }, []);
  
  const unselectDraft = useCallback(() => {
      setActiveDraftId(null);
  }, []);

  const deleteDraft = useCallback((draftId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    if (activeDraftId === draftId) {
        setActiveDraftId(null);
    }
  }, [activeDraftId]);

  const deleteActiveDraft = useCallback(() => {
      if(activeDraftId) {
          deleteDraft(activeDraftId);
      }
  }, [activeDraftId, deleteDraft]);
  
  const goToStep = useCallback((step: number) => {
    if (!activeDraftId || step <= 0 || step > totalSteps + 1) return;
     setDrafts(prevDrafts =>
        prevDrafts.map(d =>
            d.id === activeDraftId
            ? { ...d, currentStep: step, lastModified: Date.now() }
            : d
        )
    );
  }, [activeDraftId, totalSteps]);

  const nextStep = useCallback(() => goToStep((activeDraft?.currentStep || 0) + 1), [activeDraft, goToStep]);
  
  const prevStep = useCallback(() => {
     if (activeDraft?.currentStep === 1) {
        unselectDraft();
    } else {
        goToStep((activeDraft?.currentStep || 1) - 1);
    }
  }, [activeDraft, goToStep, unselectDraft]);

  return (
    <SellFormContext.Provider value={{ 
        drafts, 
        activeDraft, 
        startNewDraft, 
        selectDraft, 
        deleteDraft, 
        unselectDraft,
        setFormData, 
        currentStep: activeDraft?.currentStep || 1,
        formData: activeDraft?.formData || {},
        nextStep, 
        prevStep, 
        goToStep, 
        deleteActiveDraft: deleteActiveDraft,
        totalSteps,
    }}>
      {children}
    </SellFormContext.Provider>
  );
};

export const useSellForm = () => {
  const context = useContext(SellFormContext);
  if (context === undefined) {
    throw new Error('useSellForm must be used within a SellFormProvider');
  }
  return context;
};
