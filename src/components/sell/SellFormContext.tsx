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

const STORAGE_KEY = 'marigo_sell_drafts_v7';

/**
 * Convert a Blob/File to a base64 data URI for localStorage persistence.
 * blob: URLs die when the page reloads — data URIs survive.
 */
async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert image to data URI'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert a data URI back to a File object for upload.
 */
function dataUriToFile(dataUri: string, fileName: string, mimeType: string): File {
  const [header, base64] = dataUri.split(',');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mimeType || 'image/jpeg' });
}

export const SellFormProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [drafts, setDrafts] = useState<SellDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  const totalSteps = 6;

  // Initial Load from localStorage — restore File objects from data URIs
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SellDraft[] = JSON.parse(saved);
        // Rehydrate: convert persisted data URIs back to File objects
        const rehydrated = parsed.map(d => ({
          ...d,
          formData: {
            ...d.formData,
            images: d.formData.images?.map(img => {
              // If url is a data URI, reconstruct the File object
              if (img.url && img.url.startsWith('data:')) {
                return {
                  ...img,
                  file: dataUriToFile(img.url, img.name || 'image.jpg', img.type || 'image/jpeg'),
                };
              }
              // If url is an https Firebase Storage URL (already uploaded), keep as-is
              return img;
            }) || [],
          },
        }));
        setDrafts(rehydrated);
      }
    } catch (e) {
      console.warn('Failed to load drafts from localStorage:', e);
    }
    setIsInitialized(true);
  }, []);

  const saveToStorage = useCallback(async (data: SellDraft[]) => {
    try {
      // Convert blob: URLs to data URIs so they survive page reloads.
      // Already-uploaded https:// URLs and existing data: URIs are kept as-is.
      const sanitizedDrafts = await Promise.all(
        data.slice(0, 5).map(async (d) => {
          const persistedImages = await Promise.all(
            (d.formData.images || []).map(async (img) => {
              let persistUrl = img.url;

              // blob: URLs will die on reload — convert to data URI
              if (img.url && img.url.startsWith('blob:') && img.file instanceof Blob) {
                try {
                  persistUrl = await blobToDataUri(img.file);
                } catch {
                  // If conversion fails, skip this image in persistence
                  return null;
                }
              }

              return {
                url: persistUrl,
                name: img.name,
                type: img.type,
                position: img.position,
                // File object is deliberately excluded from JSON serialization
              };
            })
          );

          return {
            ...d,
            formData: {
              ...d.formData,
              images: persistedImages.filter(Boolean),
            },
          };
        })
      );

      const json = JSON.stringify(sanitizedDrafts);
      // Guard against exceeding localStorage quota (~5MB)
      if (json.length > 4 * 1024 * 1024) {
        console.warn('Draft data too large for localStorage, skipping image persistence');
        // Fallback: save without images
        const fallback = sanitizedDrafts.map(d => ({
          ...d,
          formData: { ...d.formData, images: [] },
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      } else {
        localStorage.setItem(STORAGE_KEY, json);
      }
    } catch (e) {
      console.warn('Failed to save drafts:', e);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    // saveToStorage is async (converts blobs to data URIs) — fire and forget
    saveToStorage(drafts).catch(console.warn);
  }, [drafts, isInitialized, saveToStorage]);

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
        formData: {
          images: [],
          allowOffers: true,
          listingType: 'fixed_price'
        },
        currentStep: 1,
        lastModified: Date.now(),
    };
    setDrafts(prev => [...prev, newDraft]);
    setActiveDraftId(newDraftId);
  }, []);

  const selectDraft = (id: string) => setActiveDraftId(id);
  
  const deleteDraft = useCallback((id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
    if (activeDraftId === id) setActiveDraftId(null);
    toast({ title: "Draft deleted" });
  }, [activeDraftId, toast]);

  const deleteActiveDraft = useCallback(() => {
    if (!activeDraftId) return;
    setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
    setActiveDraftId(null);
  }, [activeDraftId]);

  const goToStep = (step: number) => {
    if (!activeDraftId) return;
    setDrafts(prev => prev.map(d => d.id === activeDraftId ? { ...d, currentStep: step } : d));
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
