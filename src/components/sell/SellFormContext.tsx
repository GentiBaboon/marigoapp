'use client';

import React, { useState, createContext, useContext, ReactNode } from 'react';
import type { SellFormValues } from '@/lib/types';

interface SellFormContextType {
  formData: Partial<SellFormValues>;
  setFormData: (data: Partial<SellFormValues>) => void;
  currentStep: number;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  totalSteps: number;
}

const SellFormContext = createContext<SellFormContextType | undefined>(undefined);

export const SellFormProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [formData, setFormDataState] = useState<Partial<SellFormValues>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  const setFormData = (newData: Partial<SellFormValues>) => {
    setFormDataState((prev) => ({ ...prev, ...newData }));
  };

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, totalSteps + 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));
  const goToStep = (step: number) => {
    if (step > 0 && step <= totalSteps + 1) {
      setCurrentStep(step);
    }
  };

  return (
    <SellFormContext.Provider value={{ formData, setFormData, currentStep, nextStep, prevStep, goToStep, totalSteps }}>
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
