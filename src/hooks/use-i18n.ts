'use client';

import { useContext } from 'react';
import { I18nContext } from '@/context/I18nProvider';

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
