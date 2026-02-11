'use client';
import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import * as React from 'react';

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
import { FileText, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';

type Step2Values = z.infer<typeof sellStep2Schema>;
type ProofFile = {
  file: File;
  preview: string;
};

export function DetailsStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const { toast } = useToast();
  const [proofFiles, setProofFiles] = useState<ProofFile[]>(formData.proofOfOrigin || []);

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

  const selectedSizeStandard = form.watch('sizeStandard');

  // Corrected logic to determine if sizing is applicable
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

    const newFiles = acceptedFiles.map(file => Object.assign({ file }, {
      preview: URL.createObjectURL(file)
    }));

    setProofFiles(prevFiles => [...prevFiles, ...newFiles]);
  }, [toast]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
  });

  useEffect(() => {
    form.setValue('proofOfOrigin', proofFiles);
  }, [proofFiles, form]);

  useEffect(() => {
    return () => proofFiles.forEach(file => URL.revokeObjectURL(file.preview));
  }, [proofFiles]);

  const removeFile = (previewUrl: string) => {
    setProofFiles(prevFiles => prevFiles.filter(file => file.preview !== previewUrl));
  };


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
                       {proofFiles.map((file, index) => (
                         <div key={index} className="relative aspect-square">
                           {file.file.type.startsWith('image/') ? (
                              <Image
                                src={file.preview}
                                alt={`Proof preview ${index}`}
                                fill
                                sizes="128px"
                                className="rounded-md object-cover"
                              />
                           ) : (
                              <div className="flex flex-col items-center justify-center h-full w-full bg-muted rounded-md p-2">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                                <span className="text-xs text-center break-all text-muted-foreground mt-2">{file.file.name}</span>
                              </div>
                           )}
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
