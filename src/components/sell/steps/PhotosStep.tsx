'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSellForm } from '@/components/sell/SellFormContext';
import { StepActions } from '@/components/sell/StepActions';
import { X, Camera, Info, Plus } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type ImageFile = {
  file: File;
  preview: string;
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
  const [files, setFiles] = useState<ImageFile[]>(formData.images || []);
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(({ errors }) => {
            errors.forEach((err: any) => {
                 toast({
                    variant: 'destructive',
                    title: 'Upload Error',
                    description: err.message,
                });
            })
        })
      }

      const newFiles = acceptedFiles.map((file) =>
        Object.assign({ file }, { preview: URL.createObjectURL(file) })
      );

      setFiles((prevFiles) => {
        const combined = [...prevFiles, ...newFiles];
        if (combined.length > 15) {
            toast({
                variant: 'destructive',
                title: 'Too many images',
                description: 'You can upload a maximum of 15 images.',
            });
            return combined.slice(0, 15);
        }
        return combined;
      });
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [] },
    maxSize: 5 * 1024 * 1024, // 5MB
    validator: (file) => {
        return new Promise((resolve) => {
            const image = document.createElement('img');
            const objectUrl = URL.createObjectURL(file);
            image.src = objectUrl;
            image.onload = () => {
                const { width, height } = image;
                URL.revokeObjectURL(objectUrl);
                if (width < 900 || height < 900) {
                    resolve({
                        code: 'image-too-small',
                        message: `Image ${file.name} is too small. Minimum size is 900x900px.`
                    });
                } else {
                    resolve(null);
                }
            };
            image.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve({
                    code: 'invalid-image',
                    message: `Could not validate image ${file.name}.`
                });
            }
        });
    }
  });

  const removeFile = (previewUrl: string) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.preview !== previewUrl));
  };
  
  const handleNext = () => {
    if (files.length < 3) {
        toast({
            variant: 'destructive',
            title: 'Not enough photos',
            description: 'Please upload at least 3 photos to continue.',
        });
        return;
    }
    setFormData({ images: files });
    nextStep();
  }

  useEffect(() => {
    return () => files.forEach((file) => URL.revokeObjectURL(file.preview));
  }, [files]);

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
            {files.map((file, index) => (
              <div key={index} className="relative aspect-square">
                <Image
                  src={file.preview}
                  alt={`Preview ${index}`}
                  fill
                  sizes="128px"
                  className="rounded-md object-cover"
                />
                <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={(e) => { e.stopPropagation(); removeFile(file.preview); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground">The minimum image size is: 900 x 900 px</p>

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
