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

const STORAGE_KEY = 'marigo_sell_drafts_v3';

export const SellFormProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [drafts, setDrafts] = useState<SellDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const totalSteps = 8;
  const firestore = useFirestore();

  // Load drafts on init
  useEffect(() => {
    try {
      const savedDrafts = localStorage.getItem(STORAGE_KEY);
      if (savedDrafts) {
        const parsedDrafts: SellDraft[] = JSON.parse(savedDrafts);
        setDrafts(parsedDrafts);
      }
    } catch (error) {
      // If parsing fails, just start fresh
    }
    setIsInitialized(true);
  }, []);

  // Save drafts with strict size management to avoid blocking the UI
  useEffect(() => {
    if (!isInitialized) return;
    
    const saveToLocalStorage = (data: SellDraft[]) => {
        try {
            // Keep only the most recent 3 drafts to prevent localStorage overflow
            const recentDrafts = [...data]
                .sort((a, b) => b.lastModified - a.lastModified)
                .slice(0, 3);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(recentDrafts));
        } catch (error) {
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                // If the active draft itself is too big because of images, we try saving it without images for persistence
                const minimalDrafts = data.map(d => 
                    d.id === activeDraftId ? d : { ...d, formData: { ...d.formData, images: [] } }
                );
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalDrafts.slice(0, 2)));
                } catch (e) {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        }
    };

    const timeout = setTimeout(() => saveToLocalStorage(drafts), 1000);
    return () => clearTimeout(timeout);
  }, [drafts, isInitialized, activeDraftId]);

  const activeDraft = useMemo(() => drafts.find(d => d.id === activeDraftId), [drafts, activeDraftId]);
  
  const setFormData = useCallback((newData: Partial<SellFormValues>) => {
    if (!activeDraftId) return;
    setDrafts(prev => prev.map(d =>
        d.id === activeDraftId
        ? { ...d, formData: { ...d.formData, ...newData }, lastModified: Date.now() }
        : d
    ));
  }, [activeDraftId]);
  
  const startNewDraft = useCallback(() => {
    if (!firestore) return;
    const newProductId = doc(collection(firestore, 'products')).id;
    const newDraftId = `draft_${Date.now()}`;
    const newDraft: SellDraft = {
        id: newDraftId,
        formData: { productId: newProductId },
        currentStep: 1,
        lastModified: Date.now(),
    };
    setDrafts(prev => [...prev, newDraft]);
    setActiveDraftId(newDraftId);
  }, [firestore]);

  const selectDraft = useCallback((draftId: string) => setActiveDraftId(draftId), []);
  const unselectDraft = useCallback(() => setActiveDraftId(null), []);

  const deleteDraft = useCallback((draftId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    if (activeDraftId === draftId) setActiveDraftId(null);
  }, [activeDraftId]);

  const deleteActiveDraft = useCallback(() => {
      if(activeDraftId) deleteDraft(activeDraftId);
  }, [activeDraftId, deleteDraft]);
  
  const goToStep = useCallback((step: number) => {
    if (!activeDraftId || step <= 0 || step > totalSteps + 1) return;
     setDrafts(prev => prev.map(d =>
        d.id === activeDraftId ? { ...d, currentStep: step, lastModified: Date.now() } : d
    ));
  }, [activeDraftId, totalSteps]);

  const nextStep = useCallback(() => {
      const next = (activeDraft?.currentStep || 0) + 1;
      goToStep(next);
  }, [activeDraft, goToStep]);
  
  const prevStep = useCallback(() => {
     if (activeDraft?.currentStep === 1) unselectDraft();
     else goToStep((activeDraft?.currentStep || 1) - 1);
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
        deleteActiveDraft,
        totalSteps,
    }}>
      {children}
    </SellFormContext.Provider>
  );
};

export const useSellForm = () => {
  const context = useContext(SellFormContext);
  if (context === undefined) throw new Error('useSellForm must be used within a SellFormProvider');
  return context;
};
