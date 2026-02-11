'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone, DropzoneRootProps } from 'react-dropzone';
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

const PhotoSlot = ({
  imageFile,
  onRemove,
  getRootProps,
  title,
  subtitle,
}: {
  imageFile: ImageFile | null;
  onRemove: () => void;
  getRootProps: (props?: DropzoneRootProps) => DropzoneRootProps;
  title: string;
  subtitle?: string;
}) => {
  return (
    <div className="flex flex-col gap-2 items-center">
      <div
        {...getRootProps()}
        className={`relative flex items-center justify-center w-full aspect-square rounded-lg border-2 border-dashed text-muted-foreground transition-colors cursor-pointer hover:border-primary/50 ${
          imageFile ? '' : ' p-4'
        }`}
      >
        <input {...(getRootProps().getInputProps ? getRootProps().getInputProps() : {})} />
        {imageFile ? (
          <>
            <Image
              src={imageFile.preview}
              alt={`Preview ${imageFile.file.name}`}
              fill
              sizes="128px"
              className="rounded-md object-cover"
            />
            {imageFile.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 rounded-md">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {!imageFile.isLoading && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <Plus className="h-8 w-8" />
        )}
      </div>
      <p className="font-semibold text-sm text-center">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground text-center -mt-1">{subtitle}</p>}
    </div>
  );
};


export function PhotosStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const { toast } = useToast();

  const [mainPhoto, setMainPhoto] = useState<ImageFile | null>(formData.images?.[0] ? { ...formData.images[0], id: 'main', isLoading: false } : null);
  const [brandLabelPhoto, setBrandLabelPhoto] = useState<ImageFile | null>(formData.images?.[1] ? { ...formData.images[1], id: 'brand', isLoading: false } : null);
  const [hardwarePhoto, setHardwarePhoto] = useState<ImageFile | null>(formData.images?.[2] ? { ...formData.images[2], id: 'hardware', isLoading: false } : null);
  const [additionalPhotos, setAdditionalPhotos] = useState<ImageFile[]>(formData.images?.slice(3).map((img, i) => ({ ...img, id: `add-${i}`, isLoading: false })) || []);


  const createDropHandler = (
    setter: React.Dispatch<React.SetStateAction<ImageFile | null>>,
    idPrefix: string
  ) =>
    useCallback(
      async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        const file = acceptedFiles[0];
        const imageId = `${idPrefix}-${file.name}-${file.lastModified}`;

        const imageFile: ImageFile = {
          id: imageId,
          file,
          preview: URL.createObjectURL(file),
          isLoading: true,
        };
        setter(imageFile);

        try {
          const compressedFile = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
          const newPreview = URL.createObjectURL(compressedFile);

          URL.revokeObjectURL(imageFile.preview);

          setter({
            ...imageFile,
            file: compressedFile,
            preview: newPreview,
            isLoading: false,
          });
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Image Processing Failed',
            description: `Could not process ${file.name}.`,
          });
          setter(null);
          URL.revokeObjectURL(imageFile.preview);
        }
      },
      [setter, idPrefix, toast]
    );

  const { getRootProps: mainRootProps, getInputProps: mainInputProps } = useDropzone({ onDrop: createDropHandler(setMainPhoto, 'main'), multiple: false, accept: { 'image/*': [] } });
  const { getRootProps: brandRootProps, getInputProps: brandInputProps } = useDropzone({ onDrop: createDropHandler(setBrandLabelPhoto, 'brand'), multiple: false, accept: { 'image/*': [] } });
  const { getRootProps: hardwareRootProps, getInputProps: hardwareInputProps } = useDropzone({ onDrop: createDropHandler(setHardwarePhoto, 'hardware'), multiple: false, accept: { 'image/*': [] } });

  const onDropAdditional = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (rejectedFiles.length > 0) {
        toast({ variant: 'destructive', title: 'Upload Error', description: 'Some files were rejected.' });
      }

      const newFilesToProcess: ImageFile[] = acceptedFiles.map(file => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        isLoading: true,
      }));

      setAdditionalPhotos(current => [...current, ...newFilesToProcess]);

      newFilesToProcess.forEach(async imageFile => {
        try {
          const compressedFile = await imageCompression(imageFile.file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
          const newPreview = URL.createObjectURL(compressedFile);
          
          setAdditionalPhotos(current => {
             const originalFile = current.find(f => f.id === imageFile.id);
             if (originalFile) URL.revokeObjectURL(originalFile.preview);
             return current.map(f => f.id === imageFile.id ? { ...f, file: compressedFile, preview: newPreview, isLoading: false } : f);
          });

        } catch (error) {
          toast({ variant: 'destructive', title: 'Processing Failed', description: `Could not process ${imageFile.file.name}.` });
          setAdditionalPhotos(current => current.filter(f => f.id !== imageFile.id));
        }
      });
    },
    [toast]
  );
  
  const { getRootProps: additionalRootProps, getInputProps: additionalInputProps } = useDropzone({ onDrop: onDropAdditional, accept: { 'image/*': [] } });

  const removeAdditionalFile = (idToRemove: string) => {
    setAdditionalPhotos(prev => prev.filter(file => file.id !== idToRemove));
  };
  
  const handleNext = () => {
    const allPhotos = [mainPhoto, brandLabelPhoto, hardwarePhoto, ...additionalPhotos].filter((p): p is ImageFile => p !== null);

    if (allPhotos.some(f => f.isLoading)) {
      toast({ variant: 'destructive', title: 'Still processing', description: 'Please wait for all images to finish processing.' });
      return;
    }
    if (allPhotos.length < 3) {
      toast({ variant: 'destructive', title: 'Not enough photos', description: 'Please upload at least 3 photos to continue.' });
      return;
    }
    const filesToSave = allPhotos.map(({ file, preview }) => ({ file, preview }));
    setFormData({ images: filesToSave });
    nextStep();
  }

  useEffect(() => {
    return () => {
        [mainPhoto, brandLabelPhoto, hardwarePhoto, ...additionalPhotos].forEach(img => {
            if(img) URL.revokeObjectURL(img.preview);
        });
    }
  }, []);


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Photos</h2>
        <p className="text-muted-foreground mt-1">Upload at least 3 photos</p>
        <p className="text-sm text-muted-foreground">Take photos from multiple angles to show all the details (including any flaws).</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <PhotoSlot imageFile={mainPhoto} onRemove={() => setMainPhoto(null)} getRootProps={(p) => mainRootProps(p)} title="Main Photo" />
        <PhotoSlot imageFile={brandLabelPhoto} onRemove={() => setBrandLabelPhoto(null)} getRootProps={(p) => brandRootProps(p)} title="Brand Label" subtitle="(Inside/ Outside)" />
        <PhotoSlot imageFile={hardwarePhoto} onRemove={() => setHardwarePhoto(null)} getRootProps={(p) => hardwareRootProps(p)} title="Hardware" />
      </div>

      <div
        {...additionalRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          additionalRootProps().className?.includes('drop-active') ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
        }`}
      >
        <input {...additionalInputProps()} />
        <p className="text-sm text-muted-foreground mb-4">Add up to 12 more photos</p>
        <Button type="button" variant="outline" size="lg" className="pointer-events-none rounded-full">
          <Camera className="mr-2 h-5 w-5" />
          Add photos
        </Button>
      </div>

      {additionalPhotos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {additionalPhotos.map((file) => (
            <div key={file.id} className="relative aspect-square">
              <Image src={file.preview} alt={`Preview ${file.file.name}`} fill sizes="128px" className="rounded-md object-cover" />
              {file.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 rounded-md">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              {!file.isLoading && (
                <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={(e) => { e.stopPropagation(); removeAdditionalFile(file.id); }}>
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
