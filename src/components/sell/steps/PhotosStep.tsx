'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSellForm } from '@/components/sell/SellFormContext';
import { StepActions } from '@/components/sell/StepActions';
import { X, Camera, Info, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import imageCompression from 'browser-image-compression';
import type { ImageFile, FirestoreSettings } from '@/lib/types';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

type ImageFileState = ImageFile & {
  id: string;
  isLoading: boolean;
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
  const firestore = useFirestore();
  const processingRef = useRef(new Set<string>());

  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'global') : null, [firestore]);
  const { data: settings } = useDoc<FirestoreSettings>(settingsRef);

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
          description: 'Max 15 images. Only image files are allowed.',
        });
      }

      acceptedFiles.forEach(async (file) => {
          const fileId = `${file.name}-${Date.now()}-${Math.random()}`;
          const tempUrl = URL.createObjectURL(file);

          setImageFiles(current => [...current, { id: fileId, url: tempUrl, name: file.name, type: file.type, isLoading: true }]);
          processingRef.current.add(fileId);

          try {
              const maxSizeMB = settings?.imageMaxSizeMB || 0.8;
              const maxWidthOrHeight = settings?.imageMaxDimension || 1920;

              const compressedFile = await imageCompression(file, { 
                  maxSizeMB: maxSizeMB, 
                  maxWidthOrHeight: maxWidthOrHeight, 
                  useWebWorker: true, 
                  fileType: 'image/webp' 
              });
              
              const dataUrl = await fileToDataUrl(compressedFile);

              URL.revokeObjectURL(tempUrl);
              setImageFiles(current => current.map(f => f.id === fileId ? { ...f, url: dataUrl, type: 'image/webp', isLoading: false } : f));
          } catch (error) {
              console.error("Compression error:", error);
              URL.revokeObjectURL(tempUrl);
              setImageFiles(current => current.filter(f => f.id !== fileId));
          } finally {
              processingRef.current.delete(fileId);
          }
      });
    },
    [toast, settings]
  );
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 15
  });

  const removeFile = (idToRemove: string) => {
    setImageFiles(prev => {
        const file = prev.find(f => f.id === idToRemove);
        if (file?.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
        return prev.filter(f => f.id !== idToRemove);
    });
  };
  
  const handleNext = () => {
    if (processingRef.current.size > 0) {
      toast({
        variant: 'destructive',
        title: 'Processing...',
        description: 'Please wait for images to finish compressing.',
      });
      return;
    }
    if (imageFiles.length < 3) {
      toast({
        variant: 'destructive',
        title: 'Need more photos',
        description: 'Please upload at least 3 photos to showcase your item.',
      });
      return;
    }
    nextStep();
  }

  // Update form context state whenever image list changes
  useEffect(() => {
    const validImages = imageFiles
        .filter(f => !f.isLoading)
        .map(({ url, name, type }) => ({ url, name, type }));
    
    // Use functional update or careful check to avoid infinite loops
    if (JSON.stringify(formData.images) !== JSON.stringify(validImages)) {
        setFormData({ images: validImages });
    }
  }, [imageFiles, setFormData, formData.images]);

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h2 className="text-2xl font-bold">Photos</h2>
        <p className="text-muted-foreground mt-1">Upload at least 3 high-quality photos</p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
        }`}
      >
        <input {...getInputProps()} />
        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Camera className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="font-medium">
          Drag and drop images here, or <span className="text-primary underline">browse files</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wider font-semibold">Max 15 photos • WebP/JPG/PNG</p>
      </div>

      {imageFiles.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {imageFiles.map((file) => (
            <div key={file.id} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
              <Image
                src={file.url}
                alt="Product preview"
                fill
                sizes="150px"
                className="object-cover"
              />
              {file.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
              {!file.isLoading && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-90 hover:opacity-100 shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Alert className="bg-blue-50 border-blue-100 text-blue-900">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="font-semibold text-sm">Pro Tip</AlertTitle>
        <AlertDescription className="text-xs">
            Clear, well-lit photos on a neutral background sell up to 2x faster.
        </AlertDescription>
      </Alert>

      <StepActions onNext={handleNext} isNextDisabled={imageFiles.length < 3 || processingRef.current.size > 0} />
    </div>
  );
}
