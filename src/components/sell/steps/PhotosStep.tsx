'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSellForm } from '@/components/sell/SellFormContext';
import { StepActions } from '@/components/sell/StepActions';
import { X, Camera, Info, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import imageCompression from 'browser-image-compression';
import type { ImageFile } from '@/lib/types';

type ImageFileState = ImageFile & {
  id: string;
  isLoading: boolean;
  error?: string;
};

const fileToDataUrl = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export function PhotosStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const { toast } = useToast();

  const [imageFiles, setImageFiles] = useState<ImageFileState[]>(
    formData.images?.map((img, i) => ({ 
        ...img,
        id: `initial-${i}-${Math.random()}`, 
        isLoading: false 
    })) || []
  );

  const MAX_PHOTOS = 15;

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (rejectedFiles.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Upload Error',
          description: 'Some files were rejected. Please upload valid image files.',
        });
      }

      const remainingSlots = MAX_PHOTOS - imageFiles.length;
      if (remainingSlots <= 0) {
        toast({
          variant: 'destructive',
          title: 'Maximum reached',
          description: `You can upload a maximum of ${MAX_PHOTOS} photos.`,
        });
        return;
      }

      const filesToProcess = acceptedFiles.slice(0, remainingSlots);
      if (filesToProcess.length < acceptedFiles.length) {
        toast({
          title: 'Limit applied',
          description: `Only ${filesToProcess.length} of ${acceptedFiles.length} photos were added to stay within the ${MAX_PHOTOS} photo limit.`,
        });
      }

      filesToProcess.forEach(async (file) => {
          const fileId = `${file.name}-${Date.now()}`;
          const tempUrl = URL.createObjectURL(file);

          setImageFiles(current => [...current, { id: fileId, url: tempUrl, name: file.name, type: file.type, isLoading: true }]);

          try {
              const webpFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true, fileType: 'image/webp' });
              const dataUrl = await fileToDataUrl(webpFile);

              URL.revokeObjectURL(tempUrl);
              setImageFiles(current => current.map(f => f.id === fileId ? { ...f, url: dataUrl, name: `${file.name.split('.')[0]}.webp`, type: 'image/webp', isLoading: false } : f));
          } catch (error) {
              console.error("Image processing failed:", error);
              toast({ variant: 'destructive', title: 'Processing Failed', description: `Could not process ${file.name}` });
              URL.revokeObjectURL(tempUrl);
              setImageFiles(current => current.filter(f => f.id !== fileId));
          }
      });
    },
    [toast, imageFiles.length]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    disabled: imageFiles.length >= MAX_PHOTOS,
  });

  const removeFile = (idToRemove: string) => {
    setImageFiles(prev => prev.filter(file => file.id !== idToRemove));
  };
  
  const handleNext = () => {
    if (imageFiles.some(f => f.isLoading)) {
      toast({
        variant: 'destructive',
        title: 'Still processing',
        description: 'Please wait for all images to finish processing before continuing.',
      });
      return;
    }
    if (imageFiles.length < 3) {
      toast({
        variant: 'destructive',
        title: 'Not enough photos',
        description: 'Please upload at least 3 photos to continue.',
      });
      return;
    }
    nextStep();
  }

  useEffect(() => {
    const filesToSave: ImageFile[] = imageFiles
        .filter(f => !f.isLoading && !f.error)
        .map(({ url, name, type }) => ({ url, name, type }));
    setFormData({ images: filesToSave });
  }, [imageFiles, setFormData]);

  useEffect(() => {
    return () => {
        imageFiles.forEach(file => {
            if (file.url.startsWith('blob:')) {
                URL.revokeObjectURL(file.url);
            }
        });
    }
  }, [imageFiles]);


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Photos</h2>
        <p className="text-muted-foreground mt-1">Upload at least 3 photos</p>
        <p className="text-sm text-muted-foreground">Take photos from multiple angles to show all the details (including any flaws).</p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">
          Drop your images here, or <span className="text-primary">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">Maximum 15 photos</p>
      </div>

      {imageFiles.length > 0 && (
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {imageFiles.map((file) => (
            <div key={file.id} className="relative aspect-square">
              <Image
                src={file.url}
                alt={`Preview ${file.name}`}
                fill
                sizes="128px"
                className="rounded-md object-cover"
              />
              {file.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 rounded-md">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              {!file.isLoading && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Alert className="bg-muted/50">
        <Info className="h-4 w-4" />
        <AlertTitle className="font-semibold">Great photos sell faster</AlertTitle>
        <AlertDescription>For your main photo, lay the item flat by itself on a plain, contrasting color so we can easily remove the background.</AlertDescription>
      </Alert>

      <StepActions onNext={handleNext} />
    </div>
  );
}
