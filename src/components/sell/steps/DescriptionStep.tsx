'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep4Schema } from '@/lib/types';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Wand2, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { productCategories } from '@/lib/mock-data';
import { generateDescription, type GenerateDescriptionInput } from '@/ai/flows/generate-description';


type Step4Values = z.infer<typeof sellStep4Schema>;

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 30 }, (_, i) => String(currentYear - i));

const originOptions = [
    { value: 'direct', label: 'Direct from brand' },
    { value: 'private', label: 'Private sale or staff sale' },
    { value: 'vestiaire', label: 'Bought on Vestiaire Collective' },
    { value: 'other', label: 'Other' },
]

const packagingItems = [
    { id: 'card', label: 'Card or certificate' },
    { id: 'dustBag', label: 'Dust bag' },
    { id: 'box', label: 'Original box' },
]

export function DescriptionStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const { toast } = useToast();

  const form = useForm<Step4Values>({
    resolver: zodResolver(sellStep4Schema),
    defaultValues: {
      title: formData.title || '',
      description: formData.description || '',
      origin: formData.origin,
      yearOfPurchase: formData.yearOfPurchase,
      serialNumber: formData.serialNumber || '',
      packaging: formData.packaging || [],
    },
  });

  const getCategoryName = (gender: string | undefined, categorySlug: string | undefined): string => {
    if (!gender || !categorySlug) return formData.category || '';
    const genderName = `${gender.charAt(0).toUpperCase()}${gender.slice(1)}'s`;
    
    for (const mainCategory of productCategories) {
        const sub = mainCategory.subcategories.find(s => s.slug === categorySlug);
        if (sub) {
            return `${genderName} ${sub.name}`;
        }
    }
    return `${genderName} ${categorySlug}`;
  }

  const handleGenerateDescription = async () => {
    setIsGenerating(true);
    try {
      if (!formData.title || !formData.brand || !formData.category || !formData.images || formData.images.length === 0) {
           toast({
              variant: 'destructive',
              title: 'Missing Information',
              description: 'Please provide a title, brand, category, and at least one photo before generating a description.',
          });
          setIsGenerating(false);
          return;
      }
      
      const categoryName = getCategoryName(formData.gender, formData.category);

      const input: GenerateDescriptionInput = {
        title: formData.title,
        brand: formData.brand,
        category: categoryName,
        condition: formData.condition,
        images: formData.images.map(img => img.preview),
      };

      const result = await generateDescription(input);
      form.setValue('description', result.description, { shouldValidate: true });
      toast({
          title: 'Description Generated!',
          description: 'The AI-generated description has been added.',
      });
    } catch (error) {
      console.error("AI description generation failed:", error);
      toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description: 'Could not generate a description at this time. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };


  const onSubmit = (data: Step4Values) => {
    setFormData(data);
    nextStep();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Description</CardTitle>
        <CardDescription>
          Add details about your item to attract buyers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Chanel Classic Medium Double Flap Bag" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Description</FormLabel>
                    <Button type="button" variant="outline" size="sm" onClick={handleGenerateDescription} disabled={isGenerating}>
                        {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        Generate with AI
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the item's features, history, and any imperfections."
                      className="resize-y min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />

            <FormField
              control={form.control}
              name="origin"
              render={({ field }) => (
                <FormItem className="space-y-4">
                  <FormLabel>Origin <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                   <Alert variant="default" className="bg-muted/50">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        We can't accept items gifted at VIP or press events, sent complimentary, or offered in-store as part of a purchase. Items from private and staff sales may also be ineligible.
                    </AlertDescription>
                  </Alert>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="space-y-2"
                    >
                      {originOptions.map((option) => (
                        <FormItem key={option.value} className="flex items-center space-x-3">
                          <FormControl>
                            <RadioGroupItem value={option.value} />
                          </FormControl>
                          <FormLabel className="font-normal">{option.label}</FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="yearOfPurchase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year of purchase</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial number <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                  <FormDescription>
                    This information will not be publicly displayed.
                  </FormDescription>
                  <FormControl>
                    <Input placeholder="Serial number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="packaging"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Packaging <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                  </div>
                  {packagingItems.map((item) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name="packaging"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={item.id}
                            className="flex flex-row items-start space-x-3 space-y-0 mb-3"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), item.id])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== item.id
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {item.label}
                            </FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                  <FormMessage />
                </FormItem>
              )}
            />

            <StepActions onNext={form.handleSubmit(onSubmit)} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
