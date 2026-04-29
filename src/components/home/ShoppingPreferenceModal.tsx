'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const preferences = [
  {
    id: 'womenswear',
    label: 'Womenswear',
    imageId: 'preference-women',
  },
  {
    id: 'menswear',
    label: 'Menswear',
    imageId: 'preference-men',
  },
];

export function ShoppingPreferenceModal() {
  const [isOpen, setIsOpen] = useState(false);
  // Default to womenswear as requested
  const [selectedPreference, setSelectedPreference] = useState<string | null>('womenswear');

  useEffect(() => {
    const preference = localStorage.getItem('marigo_shopping_preference');
    if (!preference) {
      setIsOpen(true);
    }
  }, []);

  const handleContinue = () => {
    if (selectedPreference) {
      localStorage.setItem('marigo_shopping_preference', selectedPreference);
      setIsOpen(false);
    }
  };
  
  // Prevent closing by clicking outside or pressing Escape until a preference is set
  const onOpenChange = (open: boolean) => {
    // Only allow closing if a preference has been set and saved
    if (localStorage.getItem('marigo_shopping_preference')) {
        setIsOpen(open);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-auto rounded-t-lg"
      >
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="font-headline text-lg tracking-tight">Select shopping preference</SheetTitle>
          <SheetDescription className="text-xs">
            Personalize your homepage to get started.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2">
          {preferences.map((pref) => {
            const imageData = PlaceHolderImages.find((p) => p.id === pref.imageId);
            const isSelected = selectedPreference === pref.id;
            return (
              <button
                key={pref.id}
                onClick={() => setSelectedPreference(pref.id)}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 border rounded-md cursor-pointer transition-all text-left",
                  isSelected && "border-primary ring-1 ring-primary bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{pref.label}</span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
        <div className="mt-5">
          <Button
            size="default"
            className="w-full bg-foreground text-background hover:bg-foreground/90 text-sm h-11"
            onClick={handleContinue}
            disabled={!selectedPreference}
          >
            Continue
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
