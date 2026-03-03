'use client';
import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function PhotosStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const { toast } = useToast();
  
  const [localImages, setLocalImages] = useState(formData.images || []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const currentCount = localImages.length;
    if (currentCount + acceptedFiles.length > 8) {
      toast({ variant: "destructive", title: "Maximum 8 photos allowed" });
      return;
    }

    const newItems = acceptedFiles.map((file, i) => ({
      url: URL.createObjectURL(file),
      name: file.name,
      type: file.type,
      position: currentCount + i,
      file: file // Keep the actual file object for the final upload
    }));

    const updated = [...localImages, ...newItems];
    setLocalImages(updated);
    setFormData({ images: updated });
  }, [localImages, setFormData, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 8 - localImages.length,
  });

  const removePhoto = (index: number) => {
    const updated = [...localImages];
    const removed = updated.splice(index, 1)[0];
    if (removed.url.startsWith('blob:')) {
      URL.revokeObjectURL(removed.url);
    }
    const final = updated.map((img, i) => ({ ...img, position: i }));
    setLocalImages(final);
    setFormData({ images: final });
  };

  const canContinue = localImages.length >= 3;

  return (
    <div className="space-y-6">
      <div className="bg-muted/30 p-4 rounded-lg border border-dashed text-center">
        <h3 className="font-semibold text-lg text-primary">Photo Upload</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add at least 3 photos. They will be saved to our database in the final step.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        <Camera className="h-10 w-10 text-muted-foreground mb-2" />
        <p className="font-medium text-center px-4">Drag & drop or click to add photos</p>
        <p className="text-xs text-muted-foreground mt-1">Temporary local preview</p>
      </div>

      {localImages.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {localImages.map((img, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
              <Image 
                src={img.url} 
                alt="Preview" 
                fill 
                className="object-cover"
                unoptimized={img.url.startsWith('blob:')}
              />
              
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button 
                  type="button"
                  className="bg-destructive text-white p-2 rounded-full hover:scale-110 transition-transform" 
                  onClick={() => removePhoto(index)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {index === 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold py-0.5 text-center uppercase">Main</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-4">
        <Button 
          className="w-full h-14 text-lg font-bold" 
          size="lg" 
          disabled={!canContinue} 
          onClick={nextStep}
        >
          Continue ({localImages.length}/8)
        </Button>
        {!canContinue && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            Add {3 - localImages.length} more photo(s) to continue
          </p>
        )}
      </div>
    </div>
  );
}
