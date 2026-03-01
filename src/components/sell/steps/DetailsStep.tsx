'use client';
import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import * as React from 'react';
import imageCompression from 'browser-image-compression';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep2Schema } from '@/lib/types';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import {
  productConditions,
  productCategories,
  productMaterials,
  productColors,
  productPatterns,
  sizeStandards,
  shoeSizes,
  clothingSizes,
} from '@/lib/mock-data';
import { FileText, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import type { ProofFile } from '@/lib/types';

type Step2Values = z.infer<typeof sellStep2Schema>;

type ProofFileState = {
    id: string;
    url: string;
    name: string;
    type: string;
    isLoading: boolean;
};

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export function DetailsStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const { toast } = useToast();

  const getCategoryPath = React.useCallback((slug: string | undefined): string => {
    if (!slug) return '';
    for (const mainCategory of productCategories) {
        for (const subCategory of mainCategory.subcategories) {
            if (subCategory.slug === slug) {
                return `${mainCategory.name} / ${subCategory.name}`;
            }
        }
    }
    return slug; // fallback
  }, []);

  const form = useForm<Step2Values>({
    resolver: zodResolver(sellStep2Schema),
    defaultValues: {
      condition: formData.condition,
      sizeStandard: formData.sizeStandard,
      sizeValue: formData.sizeValue,
      material: formData.material || '',
      color: formData.color || '',
      pattern: formData.pattern || '',
      vintage: formData.vintage || false,
      proofOfOrigin: formData.proofOfOrigin || [],
    },
  });
  
  const [proofFiles, setProofFiles] = useState<ProofFileState[]>(
    formData.proofOfOrigin?.map((file, i) => ({
        ...file,
        id: `initial-proof-${i}`,
        isLoading: false,
    })) || []
  );

  const selectedSizeStandard = form.watch('sizeStandard');

  const { isClothing, isShoes, isSizingApplicable } = React.useMemo(() => {
    const selectedSubCategorySlug = formData.category;
    if (!selectedSubCategorySlug) {
      return { isClothing: false, isShoes: false, isSizingApplicable: false };
    }
    
    let parentCategoryName = '';
    for (const category of productCategories) {
        if (category.subcategories.some(sub => sub.slug === selectedSubCategorySlug)) {
            parentCategoryName = category.name;
            break;
        }
    }

    const isClothing = parentCategoryName === 'Clothing';
    const isShoes = parentCategoryName === 'Shoes';
    const isSizingApplicable = isClothing || isShoes;

    return { isClothing, isShoes, isSizingApplicable };
  }, [formData.category]);
  

  const sizeValues = React.useMemo(() => {
    if (!isSizingApplicable) return [];
    if (isClothing) return clothingSizes;
    if (isShoes) {
      if (!selectedSizeStandard) return [];
      return shoeSizes[selectedSizeStandard as keyof typeof shoeSizes] || [];
    }
    return [];
  }, [isSizingApplicable, isClothing, isShoes, selectedSizeStandard]);

  useEffect(() => {
    form.setValue('sizeValue', undefined);
  }, [selectedSizeStandard, form]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Upload Error',
        description: 'Some files were rejected. Please upload valid image or PDF files.',
      });
    }

    const newFilesToProcess = acceptedFiles.map(file => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '', // Create blob only for images
        name: file.name,
        type: file.type,
        isLoading: true,
        file: file, // Keep original file for processing
    }));
    
    setProofFiles(current => [...current, ...newFilesToProcess]);

    newFilesToProcess.forEach(async (fileState) => {
        try {
            let finalFile = fileState.file;
            if (fileState.type.startsWith('image/')) {
                finalFile = await imageCompression(fileState.file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
            }

            const dataUrl = await fileToDataUrl(finalFile);

            setProofFiles(current => {
                const originalFile = current.find(f => f.id === fileState.id);
                if (originalFile && originalFile.url.startsWith('blob:')) {
                    URL.revokeObjectURL(originalFile.url);
                }
                return current.map(f => f.id === fileState.id ? { ...f, url: dataUrl, isLoading: false } : f);
            });
        } catch (error) {
            console.error("File processing error:", error);
            toast({ variant: 'destructive', title: 'File Error', description: `Could not process ${fileState.name}.` });
            setProofFiles(current => current.filter(f => f.id !== fileState.id));
        }
    });
}, [toast]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
  });

  const removeFile = (idToRemove: string) => {
    setProofFiles(prevFiles => prevFiles.filter(file => file.id !== idToRemove));
  };
  
  useEffect(() => {
    const filesToSave: ProofFile[] = proofFiles
        .filter(f => !f.isLoading)
        .map(({ url, name, type }) => ({ url, name, type }));
    form.setValue('proofOfOrigin', filesToSave);
  }, [proofFiles, form]);


  useEffect(() => {
    return () => proofFiles.forEach(file => {
        if(file.url.startsWith('blob:')) {
            URL.revokeObjectURL(file.url)
        }
    });
  }, [proofFiles]);


  const onSubmit = (data: Step2Values) => {
    if (isSizingApplicable) {
        if (!data.sizeStandard) {
            form.setError('sizeStandard', {type: 'manual', message: 'Standard is required.'});
            return;
        }
        if (!data.sizeValue) {
            form.setError('sizeValue', {type: 'manual', message: 'Value is required.'});
            return;
        }
    }
    setFormData(data);
    nextStep();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <h2 className="text-2xl font-semibold tracking-tight">Item details</h2>

        <FormItem>
          <FormLabel>Category</FormLabel>
          <FormControl>
            <Input readOnly value={getCategoryPath(formData.category)} />
          </FormControl>
        </FormItem>

        <FormField
          control={form.control}
          name="condition"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Condition</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a condition" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {productConditions.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="material"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Material</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value}
                  onValueChange={field.onChange}
                  items={productMaterials.map((material) => ({
                    value: material,
                    label: material,
                  }))}
                  placeholder="Select material"
                  searchPlaceholder="Search materials..."
                  emptyPlaceholder="No material found."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Color</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value}
                  onValueChange={field.onChange}
                  items={productColors.map((color) => ({
                    value: color.name,
                    label: color.name,
                  }))}
                  placeholder="Select color"
                  searchPlaceholder="Search colors..."
                  emptyPlaceholder="No color found."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isSizingApplicable && (
          <div className="space-y-2">
              <Label className="text-sm font-medium">Size</Label>
              <div className="grid grid-cols-2 gap-4">
                  <FormField
                      control={form.control}
                      name="sizeStandard"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel className="text-sm text-muted-foreground">Standard</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                      <SelectTrigger>
                                          <SelectValue placeholder="Choose" />
                                      </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                      {sizeStandards.map(std => (
                                          <SelectItem key={std.value} value={std.value}>{std.label}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                    <FormField
                      control={form.control}
                      name="sizeValue"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel className="text-sm text-muted-foreground">Value</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSizeStandard && !isClothing}>
                                  <FormControl>
                                      <SelectTrigger>
                                          <SelectValue placeholder="Choose" />
                                      </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                      {sizeValues.map(val => (
                                          <SelectItem key={val} value={val}>{val}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
              </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="pattern"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Pattern</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value}
                  onValueChange={field.onChange}
                  items={productPatterns.map((pattern) => ({
                    value: pattern,
                    label: pattern,
                  }))}
                  placeholder="Select pattern"
                  searchPlaceholder="Search patterns..."
                  emptyPlaceholder="No pattern found."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="vintage"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Vintage <span className="font-normal text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormDescription>
                  Select if this item is over 15 years old.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="proofOfOrigin"
          render={({ field }) => (
            <FormItem>
               <FormLabel>
                 Proof of origin <span className="font-normal text-muted-foreground">(optional)</span>
               </FormLabel>
               <FormDescription>
                 This information will not be publicly displayed.
               </FormDescription>
               <FormControl>
                 <div>
                   <div
                     {...getRootProps()}
                     className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                       isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                     }`}
                   >
                     <input {...getInputProps()} />
                     <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                     <p className="mt-4 text-muted-foreground">
                      Add receipt, authenticity card, or invoice
                     </p>
                   </div>
                   {proofFiles.length > 0 && (
                     <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-4">
                       {proofFiles.map((file) => (
                         <div key={file.id} className="relative aspect-square">
                           {file.type.startsWith('image/') ? (
                              <Image
                                src={file.url}
                                alt={`Proof preview ${file.name}`}
                                fill
                                sizes="128px"
                                className="rounded-md object-cover"
                              />
                           ) : (
                              <div className="flex flex-col items-center justify-center h-full w-full bg-muted rounded-md p-2">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                                <span className="text-xs text-center break-all text-muted-foreground mt-2">{file.name}</span>
                              </div>
                           )}
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
                                   onClick={() => removeFile(file.id)}
                               >
                                 <X className="h-4 w-4" />
                               </Button>
                           )}
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               </FormControl>
               <FormMessage />
            </FormItem>
          )}
        />
        
        <StepActions onNext={form.handleSubmit(onSubmit)} />
      </form>
    </Form>
  );
}
