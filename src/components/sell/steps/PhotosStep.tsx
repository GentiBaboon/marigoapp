'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSellForm } from '@/components/sell/SellFormContext';
import { StepActions } from '@/components/sell/StepActions';
import { X, Camera, Info, Plus, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import imageCompression from 'browser-image-compression';

type ImageFile = {
  id: string;
  file: File;
  preview: string;
  isLoading: boolean;
};

const PhotoPlaceholder = ({ title, subtitle }: { title: string, subtitle?: string }) => (
    <div className="flex flex-col items-center gap-2">
        <div className="flex items-center justify-center w-full aspect-square rounded-lg border-2 border-dashed text-muted-foreground">
            <Plus className="h-8 w-8" />
        </div>
        <p className="font-semibold text-sm text-center">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground text-center -mt-1">{subtitle}</p>}
    </div>
)

export function PhotosStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const [files, setFiles] = useState<ImageFile[]>(() => 
    (formData.images || []).map((img, index) => ({
      id: `initial-${index}`,
      file: img.file,
      preview: img.preview,
      isLoading: false
    }))
  );
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(({ file, errors }) => {
          errors.forEach((err: any) => {
            toast({
              variant: 'destructive',
              title: 'Upload Error',
              description: `${file.name}: ${err.message}`,
            });
          });
        });
      }

      const newFilesToProcess: ImageFile[] = acceptedFiles.map(file => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        isLoading: true,
      }));

      setFiles(currentFiles => {
        const combined = [...currentFiles, ...newFilesToProcess];
        if (combined.length > 15) {
          toast({
            variant: 'destructive',
            title: 'Too many images',
            description: 'You can upload a maximum of 15 images.',
          });
          const toDiscard = combined.slice(15);
          toDiscard.forEach(f => URL.revokeObjectURL(f.preview));
          return combined.slice(0, 15);
        }
        return combined;
      });

      newFilesToProcess.forEach(async imageFile => {
        try {
          const compressedFile = await imageCompression(imageFile.file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });

          const newPreview = URL.createObjectURL(compressedFile);

          setFiles(currentFiles => {
            const originalFile = currentFiles.find(f => f.id === imageFile.id);
            if (originalFile) {
              URL.revokeObjectURL(originalFile.preview);
            }
            return currentFiles.map(f =>
              f.id === imageFile.id
                ? { ...f, file: compressedFile, preview: newPreview, isLoading: false }
                : f
            );
          });
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Image Processing Failed',
            description: `Could not process ${imageFile.file.name}.`,
          });
          setFiles(currentFiles => {
            const fileToRemove = currentFiles.find(f => f.id === imageFile.id);
            if (fileToRemove) {
               URL.revokeObjectURL(fileToRemove.preview);
            }
            return currentFiles.filter(f => f.id !== imageFile.id);
          });
        }
      });
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxSize: 10 * 1024 * 1024,
  });
  
  const removeFile = (idToRemove: string) => {
    setFiles(prevFiles => {
      const fileToRemove = prevFiles.find(f => f.id === idToRemove);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prevFiles.filter(file => file.id !== idToRemove);
    });
  };
  
  const handleNext = () => {
    if (files.some(f => f.isLoading)) {
        toast({
            variant: 'destructive',
            title: 'Still processing',
            description: 'Please wait for all images to finish processing.',
        });
        return;
    }
    if (files.length < 3) {
        toast({
            variant: 'destructive',
            title: 'Not enough photos',
            description: 'Please upload at least 3 photos to continue.',
        });
        return;
    }
    const filesToSave = files.map(({ file, preview }) => ({ file, preview }));
    setFormData({ images: filesToSave });
    nextStep();
  }

  useEffect(() => {
    return () => {
      files.forEach(file => URL.revokeObjectURL(file.preview));
    };
  }, []);

  return (
    <div className="space-y-6">
        <div>
            <h2 className="text-2xl font-bold">Photos</h2>
            <p className="text-muted-foreground mt-1">Upload at least 3 photos</p>
            <p className="text-sm text-muted-foreground">Take photos from multiple angles to show all the details (including any flaws).</p>
        </div>
        
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-sm text-muted-foreground mb-4">Drag and drop up to 15 photos</p>
          <Button type="button" variant="outline" size="lg" className="pointer-events-none rounded-full">
            <Camera className="mr-2 h-5 w-5" />
            Add photos
          </Button>
        </div>
        
        {files.length > 0 && (
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {files.map((file) => (
              <div key={file.id} className="relative aspect-square">
                <Image
                  src={file.preview}
                  alt={`Preview ${file.file.name}`}
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
                        onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground">Photos should be at least 900x900px</p>

        <div className="grid grid-cols-3 gap-4">
            <PhotoPlaceholder title="Main Photo" />
            <PhotoPlaceholder title="Brand Label" subtitle="(Inside/ Outside)" />
            <PhotoPlaceholder title="Hardware" />
        </div>

        <Alert className="bg-muted/50">
            <Info className="h-4 w-4" />
            <AlertTitle className="font-semibold">Great photos sell faster</AlertTitle>
            <AlertDescription>
            For your main photo, lay the item flat by itself on a plain, contrasting color so we can easily remove the background.
            </AlertDescription>
        </Alert>

        <p className="text-sm text-muted-foreground">
            Note: Our team will review photos before your listing goes live.
        </p>

        <StepActions onNext={handleNext} />
    </div>
  );
}
