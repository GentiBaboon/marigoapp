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

type ImageFile = {
  id: string;
  file: File;
  preview: string;
  isLoading: boolean;
};

export function PhotosStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const { toast } = useToast();

  const [imageFiles, setImageFiles] = useState<ImageFile[]>(
    formData.images?.map((img, i) => ({ ...img, id: `initial-${i}`, isLoading: false })) || []
  );

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (rejectedFiles.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Upload Error',
          description: 'Some files were rejected. Please upload valid image files.',
        });
      }

      const newFilesToProcess: ImageFile[] = acceptedFiles.map(file => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        isLoading: true,
      }));

      setImageFiles(current => [...current, ...newFilesToProcess]);

      newFilesToProcess.forEach(async imageFile => {
        try {
          const compressedFile = await imageCompression(imageFile.file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });

          // Create a new preview URL for the compressed file
          const newPreview = URL.createObjectURL(compressedFile);
          
          // Once compressed, update the specific file in the state
          setImageFiles(current => {
             // Revoke the old object URL to free memory
             const originalFile = current.find(f => f.id === imageFile.id);
             if (originalFile) {
               URL.revokeObjectURL(originalFile.preview);
             }
             return current.map(f => f.id === imageFile.id ? { ...f, file: compressedFile, preview: newPreview, isLoading: false } : f);
          });

        } catch (error) {
          console.error("Compression error:", error);
          toast({
            variant: 'destructive',
            title: 'Image Processing Failed',
            description: `Could not process ${imageFile.file.name}.`,
          });
          // Remove the file that failed to process
          setImageFiles(current => current.filter(f => f.id !== imageFile.id));
        }
      });
    },
    [toast]
  );
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
  });

  const removeFile = (idToRemove: string) => {
    setImageFiles(prev => prev.filter(file => {
      if (file.id === idToRemove) {
        URL.revokeObjectURL(file.preview);
        return false;
      }
      return true;
    }));
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
    const filesToSave = imageFiles.map(({ file, preview }) => ({ file, preview }));
    setFormData({ images: filesToSave });
    nextStep();
  }

  useEffect(() => {
    // Revoke object URLs on unmount
    return () => {
        imageFiles.forEach(file => URL.revokeObjectURL(file.preview));
    }
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
                src={file.preview}
                alt={`Preview ${file.file.name}`}
                fill
                sizes="128px"
                className="rounded-md object-cover"
                onLoad={() => {
                  // If you need to do something on load, but for compression, the state update handles it.
                }}
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
