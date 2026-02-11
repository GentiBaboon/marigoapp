'use client';

import React, { useState, createContext, useContext, ReactNode, useEffect, useCallback } from 'react';
import type { SellFormValues } from '@/lib/types';

interface SellFormContextType {
  formData: Partial<SellFormValues>;
  setFormData: (data: Partial<SellFormValues>) => void;
  currentStep: number;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  resetForm: () => void;
  totalSteps: number;
  isDraft: boolean;
  savedStep: number;
}

const SellFormContext = createContext<SellFormContextType | undefined>(undefined);

export const SellFormProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [formData, setFormDataState] = useState<Partial<SellFormValues>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [savedStep, setSavedStep] = useState(1);
  const totalSteps = 6;

  // Load draft from localStorage on initial mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('sell_form_draft');
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        // Only consider it a draft if there's actual data
        if (draft.formData && Object.keys(draft.formData).length > 0) {
            setFormDataState(draft.formData);
            setSavedStep(draft.currentStep || 1);
            setIsDraft(true);
        }
      }
    } catch (error) {
      console.error("Failed to load draft from localStorage", error);
      localStorage.removeItem('sell_form_draft');
    }
    setIsInitialized(true);
  }, []);

  // Save draft to localStorage whenever formData or currentStep changes
  useEffect(() => {
    if (!isInitialized) return;
    try {
       // Don't save an empty draft
      if (Object.keys(formData).length > 0) {
        const draft = { formData, currentStep };
        localStorage.setItem('sell_form_draft', JSON.stringify(draft));
      } else {
        // If form becomes empty (e.g. after reset), remove draft from storage
        localStorage.removeItem('sell_form_draft');
      }
    } catch (error) {
      console.error("Failed to save draft to localStorage. Draft may be too large.", error);
    }
  }, [formData, currentStep, isInitialized]);


  const setFormData = useCallback((newData: Partial<SellFormValues>) => {
    setFormDataState((prev) => ({ ...prev, ...newData }));
  }, []);
  
  const resetForm = useCallback(() => {
    setFormDataState({});
    setCurrentStep(1);
    setIsDraft(false);
    setSavedStep(1);
    localStorage.removeItem('sell_form_draft');
  }, []);

  const nextStep = useCallback(() => setCurrentStep((prev) => Math.min(prev + 1, totalSteps + 1)), [totalSteps]);
  const prevStep = useCallback(() => setCurrentStep((prev) => Math.max(prev - 1, 1)), []);
  const goToStep = useCallback((step: number) => {
    if (step > 0 && step <= totalSteps + 1) {
      setCurrentStep(step);
    }
  }, [totalSteps]);

  return (
    <SellFormContext.Provider value={{ formData, setFormData, currentStep, nextStep, prevStep, goToStep, resetForm, totalSteps, isDraft, savedStep }}>
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
