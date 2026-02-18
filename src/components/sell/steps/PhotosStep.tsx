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
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirebaseApp } from '@/firebase';

type ImageFileState = ImageFile & {
  id: string;
  isLoading: boolean;
  error?: string;
};

const fileToDataUrl = (file: Blob | File): Promise<string> => {
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
  const firebaseApp = useFirebaseApp();
  const storage = getStorage(firebaseApp);

  const [imageFiles, setImageFiles] = useState<ImageFileState[]>(
    formData.images?.map((img, i) => ({ 
        ...img,
        id: `initial-${i}-${Math.random()}`, 
        isLoading: false 
    })) || []
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

      const productId = formData.productId;
      if (!productId) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not create a product draft. Please go back and try again.' });
          return;
      }

      acceptedFiles.forEach(async (file) => {
          const fileId = `${file.name}-${Date.now()}`;
          const tempUrl = URL.createObjectURL(file);

          setImageFiles(current => [...current, { id: fileId, url: tempUrl, name: file.name, type: file.type, isLoading: true }]);

          try {
              const compressedFile = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true });
              const storageRef = ref(storage, `products/${productId}/${fileId}-${file.name}`);
              await uploadBytes(storageRef, compressedFile);
              const downloadURL = await getDownloadURL(storageRef);

              URL.revokeObjectURL(tempUrl); // Clean up blob URL
              setImageFiles(current => current.map(f => f.id === fileId ? { ...f, url: downloadURL, isLoading: false } : f));
          } catch (error) {
              console.error("Upload failed:", error);
              toast({ variant: 'destructive', title: 'Upload Failed', description: `Could not upload ${file.name}` });
              URL.revokeObjectURL(tempUrl);
              setImageFiles(current => current.filter(f => f.id !== fileId));
          }
      });
    },
    [formData.productId, storage, toast]
  );
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
  });

  const removeFile = (idToRemove: string) => {
    // Note: This doesn't delete the file from Firebase Storage.
    // A more robust implementation would do that.
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

    