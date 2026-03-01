'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Camera, X, Sparkles, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function PhotosStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const currentImages = formData.images || [];
    if (currentImages.length + acceptedFiles.length > 8) {
      toast({ variant: "destructive", title: "Max 8 photos allowed" });
      return;
    }

    const newImages = acceptedFiles.map(file => ({
      url: URL.createObjectURL(file),
      name: file.name,
      type: file.type,
    }));

    setFormData({ images: [...currentImages, ...newImages] });
  }, [formData.images, setFormData, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 8
  });

  const removePhoto = (index: number) => {
    const newImages = [...(formData.images || [])];
    newImages.splice(index, 1);
    setFormData({ images: newImages });
  };

  const removeBackground = async (index: number) => {
    setProcessingId(`img-${index}`);
    // Simulate AI call
    await new Promise(r => setTimeout(r, 2000));
    toast({ title: "Background removed ✨" });
    setProcessingId(null);
  };

  const canContinue = (formData.images?.length || 0) >= 3;

  return (
    <div className="space-y-6">
      <div className="bg-muted/30 p-4 rounded-lg border border-dashed text-center">
        <h3 className="font-semibold text-lg">Tips for great photos</h3>
        <ul className="text-sm text-muted-foreground mt-2 space-y-1">
          <li>• Minimum 3 photos, maximum 8</li>
          <li>• Use natural daylight</li>
          <li>• Show any defects clearly</li>
        </ul>
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
        <p className="font-medium">Drag & drop or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WEBP (Max 10MB)</p>
      </div>

      {formData.images && formData.images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {formData.images.map((img, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
              <Image src={img.url} alt="Preview" fill className="object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removePhoto(index)}>
                  <X className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => removeBackground(index)} disabled={!!processingId}>
                  {processingId === `img-${index}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </Button>
              </div>
              {index === 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold py-0.5 text-center uppercase">Main Photo</div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button className="w-full h-14 text-lg" size="lg" disabled={!canContinue} onClick={nextStep}>
        Continue
      </Button>
    </div>
  );
}
