'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSellForm } from '@/components/sell/SellFormContext';
import { StepActions } from '@/components/sell/StepActions';
import { UploadCloud, X } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

type ImageFile = {
  file: File;
  preview: string;
};

export function PhotosStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const [files, setFiles] = useState<ImageFile[]>(formData.images || []);
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (rejectedFiles.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Upload Error',
          description: 'Some files were rejected. Please upload valid image files only.',
        });
      }

      const newFiles = acceptedFiles.map((file) =>
        Object.assign({ file }, { preview: URL.createObjectURL(file) })
      );

      setFiles((prevFiles) => {
        const combined = [...prevFiles, ...newFiles];
        if (combined.length > 10) {
            toast({
                variant: 'destructive',
                title: 'Too many images',
                description: 'You can upload a maximum of 10 images.',
            });
            return prevFiles;
        }
        return combined;
      });
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const removeFile = (previewUrl: string) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.preview !== previewUrl));
  };
  
  const handleNext = () => {
    if (files.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No images uploaded',
            description: 'Please upload at least one image to continue.',
        });
        return;
    }
    setFormData({ images: files });
    nextStep();
  }

  // Make sure to revoke the data uris to avoid memory leaks
  useEffect(() => {
    return () => files.forEach((file) => URL.revokeObjectURL(file.preview));
  }, [files]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Photos</CardTitle>
        <CardDescription>
          Add up to 10 photos of your item. Use clear, well-lit images.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            {isDragActive ? 'Drop the files here...' : "Drag 'n' drop some files here, or click to select files"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 5MB</p>
        </div>

        {files.length > 0 && (
          <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
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
                    onClick={() => removeFile(file.preview)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <StepActions onNext={handleNext} />
      </CardContent>
    </Card>
  );
}
