'use client';

import React, { useState, createContext, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import type { SellFormValues, SellDraft } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface SellFormContextType {
  drafts: SellDraft[];
  activeDraft: SellDraft | undefined;
  startNewDraft: () => void;
  selectDraft: (draftId: string) => void;
  deleteDraft: (draftId: string) => void;
  deleteActiveDraft: () => void;
  setFormData: (data: Partial<SellFormValues>) => void;
  currentStep: number;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  totalSteps: number;
  formData: Partial<SellFormValues>;
}

const SellFormContext = createContext<SellFormContextType | undefined>(undefined);

const STORAGE_KEY = 'marigo_sell_drafts_v4';

export const SellFormProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [drafts, setDrafts] = useState<SellDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  const totalSteps = 6;

  // Load drafts on init
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setDrafts(JSON.parse(saved));
    } catch (e) {}
    setIsInitialized(true);
  }, []);

  // Manual & Auto-save Logic
  const saveToStorage = useCallback((data: SellDraft[]) => {
    try {
      const recent = [...data].sort((a, b) => b.lastModified - a.lastModified).slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const interval = setInterval(() => {
      if (activeDraftId) {
        saveToStorage(drafts);
        toast({ title: "Draft auto-saved", duration: 2000 });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [drafts, isInitialized, activeDraftId, saveToStorage, toast]);

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
    const newDraftId = `draft_${Date.now()}`;
    const newDraft: SellDraft = {
        id: newDraftId,
        formData: {},
        currentStep: 1,
        lastModified: Date.now(),
    };
    setDrafts(prev => [...prev, newDraft]);
    setActiveDraftId(newDraftId);
  }, []);

  const selectDraft = (id: string) => setActiveDraftId(id);
  const deleteDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
    if (activeDraftId === id) setActiveDraftId(null);
  };

  const deleteActiveDraft = useCallback(() => {
    if (!activeDraftId) return;
    setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
    setActiveDraftId(null);
  }, [activeDraftId]);

  const goToStep = (step: number) => {
    if (!activeDraftId) return;
    setDrafts(prev => prev.map(d => d.id === activeDraftId ? { ...d, currentStep: step } : d));
    saveToStorage(drafts);
  };

  return (
    <SellFormContext.Provider value={{ 
        drafts, 
        activeDraft, 
        startNewDraft, 
        selectDraft, 
        deleteDraft, 
        deleteActiveDraft,
        setFormData, 
        currentStep: activeDraft?.currentStep || 1,
        formData: activeDraft?.formData || {},
        nextStep: () => goToStep((activeDraft?.currentStep || 1) + 1),
        prevStep: () => goToStep((activeDraft?.currentStep || 1) - 1),
        goToStep,
        totalSteps,
    }}>
      {children}
    </SellFormContext.Provider>
  );
};

export const useSellForm = () => {
  const context = useContext(SellFormContext);
  if (!context) throw new Error('useSellForm must be used within a SellFormProvider');
  return context;
};
