'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSellForm } from '../SellFormContext';
import { Button } from '@/components/ui/button';
import { Camera, X, Wand2, Loader2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';
import { removeBackground } from '@/ai/flows/remove-background';

export function PhotosStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const { toast } = useToast();
  
  const [localImages, setLocalImages] = useState(formData.images || []);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const currentCount = localImages.length;
    if (currentCount + acceptedFiles.length > 8) {
      toast({ variant: "destructive", title: "Maximum 8 photos allowed" });
      return;
    }

    setIsProcessing('compressing');
    
    try {
        const processedItems = await Promise.all(acceptedFiles.map(async (file, i) => {
            // Pre-compress for preview and storage efficiency
            const compressionOptions = {
                maxSizeMB: 0.8,
                maxWidthOrHeight: 1200,
                useWebWorker: true
            };
            const compressed = await imageCompression(file, compressionOptions);
            
            return {
                url: URL.createObjectURL(compressed),
                name: file.name,
                type: file.type,
                position: currentCount + i,
                file: compressed
            };
        }));

        const updated = [...localImages, ...processedItems];
        setLocalImages(updated);
        setFormData({ images: updated });
    } catch (e) {
        toast({ variant: 'destructive', title: "Compression failed" });
    } finally {
        setIsProcessing(null);
    }
  }, [localImages, setFormData, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 8 - localImages.length,
    disabled: !!isProcessing
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

  const handleRemoveBackground = async (index: number) => {
    const img = localImages[index];
    setIsProcessing(`bg-${index}`);
    
    try {
        // Resolve the image to a File/Blob first
        let imageFile: Blob | File | undefined = img.file;
        
        if (!imageFile) {
            const response = await fetch(img.url);
            imageFile = await response.blob();
        }

        // We need a data URI for the AI
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (e) => reject(new Error('Failed to read file: ' + e));
            reader.readAsDataURL(imageFile!);
        });

        const result = await removeBackground({ imageDataUri: dataUri });
        
        // Convert the result back to a File object for consistent storage handling
        const response = await fetch(result.enhancedImageDataUri);
        const blob = await response.blob();
        const enhancedFile = new File([blob], `enhanced_${img.name}`, { type: 'image/png' });
        
        const updated = [...localImages];
        updated[index] = {
            ...img,
            url: result.enhancedImageDataUri,
            file: enhancedFile
        };
        
        setLocalImages(updated);
        setFormData({ images: updated });
        toast({ title: "Background removed!" });
    } catch (e) {
        console.error("AI background removal failed:", e);
        toast({ variant: 'destructive', title: "AI enhancement failed" });
    } finally {
        setIsProcessing(null);
    }
  };

  const canContinue = localImages.length >= 3;

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 text-center">
        <h3 className="font-bold text-lg text-primary flex items-center justify-center gap-2">
            <Camera className="h-5 w-5" />
            Photo Upload
        </h3>
        <p className="text-sm text-muted-foreground mt-1 px-4 leading-relaxed">
          Add at least 3 photos. Use our AI to remove backgrounds for a premium look.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "aspect-video border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300",
          isDragActive ? "border-primary bg-primary/5 scale-[0.99]" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/5",
          isProcessing && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        {isProcessing === 'compressing' ? (
            <div className="flex flex-col items-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
                <p className="font-bold text-primary">Optimizing photos...</p>
            </div>
        ) : (
            <>
                <div className="bg-muted p-4 rounded-full mb-3">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-bold text-lg">Drag & drop or click</p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-bold">Max 8 photos • HQ only</p>
            </>
        )}
      </div>

      {localImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {localImages.map((img, index) => (
            <div key={index} className="relative aspect-[3/4] rounded-xl overflow-hidden border bg-muted group shadow-sm">
              <Image 
                src={img.url} 
                alt="Listing photo" 
                fill 
                className="object-cover"
                unoptimized={img.url.startsWith('blob:')}
              />
              
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-8 w-8 rounded-full" 
                    onClick={() => removePhoto(index)}
                    disabled={!!isProcessing}
                >
                  <X className="h-4 w-4" />
                </Button>
                
                <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-8 text-[10px] font-bold rounded-full bg-white text-black"
                    onClick={() => handleRemoveBackground(index)}
                    disabled={!!isProcessing}
                >
                    {isProcessing === `bg-${index}` ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                        <Wand2 className="h-3 w-3 mr-1" />
                    )}
                    STUDIO MODE
                </Button>
              </div>
              
              {index === 0 && (
                <div className="absolute top-2 left-2 bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm">Main</div>
              )}

              {isProcessing === `bg-${index}` && (
                  <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center">
                      <div className="bg-white p-2 rounded-full shadow-lg">
                        <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                      </div>
                  </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-4 space-y-4">
        <Button 
          className="w-full h-16 text-lg font-bold shadow-xl shadow-primary/20 rounded-full" 
          size="lg" 
          disabled={!canContinue || !!isProcessing} 
          onClick={nextStep}
        >
          Continue ({localImages.length}/8)
        </Button>
        {!canContinue && (
          <p className="text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Add {3 - localImages.length} more photo(s) to continue
          </p>
        )}
      </div>
    </div>
  );
}
