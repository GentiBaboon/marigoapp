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
  const [selectedPreference, setSelectedPreference] = useState<string | null>(null);

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
          <SheetTitle className="font-headline text-2xl tracking-tight">Select shopping preference</SheetTitle>
          <SheetDescription>
            Personalize your homepage to get started.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3">
          {preferences.map((pref) => {
            const imageData = PlaceHolderImages.find((p) => p.id === pref.imageId);
            const isSelected = selectedPreference === pref.id;
            return (
              <button
                key={pref.id}
                onClick={() => setSelectedPreference(pref.id)}
                className={cn(
                  "flex w-full items-center justify-between p-3 border rounded-md cursor-pointer transition-all text-left",
                  isSelected && "border-primary ring-2 ring-primary"
                )}
              >
                <div className="flex items-center gap-4">
                  {imageData && (
                    <Image
                      src={imageData.imageUrl}
                      alt={pref.label}
                      width={48}
                      height={64}
                      className="rounded-md object-cover w-12 h-16"
                    />
                  )}
                  <span className="font-medium text-base">{pref.label}</span>
                </div>
                {isSelected && <Check className="h-5 w-5 text-primary" />}
              </button>
            );
          })}
        </div>
        <div className="mt-6">
          <Button
            size="lg"
            className="w-full bg-foreground text-background hover:bg-foreground/90"
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
