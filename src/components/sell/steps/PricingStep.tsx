'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from '@/components/ui/input';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep6Schema } from '@/lib/types';
import type { z } from 'zod';
import { StepActions } from '../StepActions';
import { Button } from '@/components/ui/button';
import { Info, Wand2, Loader2 } from 'lucide-react';
import { suggestPrice, type SuggestPriceInput, type SuggestPriceOutput } from '@/ai/flows/ai-suggest-price';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { productCategories } from '@/lib/mock-data';

type Step6Values = z.infer<typeof sellStep6Schema>;

const COMMISSION_RATE = 0.20;
const FIXED_FEE = 5;

export function PricingStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const [earning, setEarning] = useState<number>(0);
  const { toast } = useToast();

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestPriceOutput | null>(null);

  const form = useForm<Step6Values>({
    resolver: zodResolver(sellStep6Schema),
    defaultValues: {
      price: formData.price,
    },
  });

  const priceValue = form.watch('price');

  useEffect(() => {
    if (priceValue && priceValue > 0) {
        const commission = priceValue * COMMISSION_RATE;
        const calculatedEarning = priceValue - commission - FIXED_FEE;
        setEarning(Math.max(0, calculatedEarning));
    } else {
        setEarning(0);
    }
  }, [priceValue]);
  
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


  const handleSuggestPrice = async () => {
    setIsSuggesting(true);
    setSuggestion(null);

    try {
        if (!formData.title || !formData.brand || !formData.category || !formData.images || formData.images.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please provide a title, brand, category, and at least one photo before generating a price suggestion.',
            });
            setIsSuggesting(false);
            return;
        }

        const categoryName = getCategoryName(formData.gender, formData.category);

        const input: SuggestPriceInput = {
            title: formData.title,
            brand: formData.brand,
            category: categoryName,
            condition: formData.condition,
            images: formData.images.map(img => img.preview),
        };
        
        const result = await suggestPrice(input);
        setSuggestion(result);

    } catch (error) {
        console.error("AI price suggestion failed:", error);
        toast({
            variant: 'destructive',
            title: 'Suggestion Failed',
            description: 'Could not generate a price suggestion at this time. Please try again.',
        });
    } finally {
        setIsSuggesting(false);
    }
  };


  const onSubmit = (data: Step6Values) => {
    setFormData({ ...data, sellerEarning: earning, currency: 'EUR' });
    nextStep();
  };

  return (
    <div className="space-y-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <h3 className="font-semibold text-lg">Price</h3>
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Set your price in EUR</FormLabel>
                    <div className="relative">
                        <Input 
                            type="number" 
                            placeholder="e.g. 550" 
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                            value={field.value ?? ''} 
                            className="h-16 text-lg pl-12"
                         />
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">EUR</span>
                    </div>
                  <FormMessage />
                  </FormItem>
              )}
            />

            <Button type="button" variant="outline" onClick={handleSuggestPrice} disabled={isSuggesting} className="w-full">
                {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                AI Price Suggestion
            </Button>
            
            {suggestion && (
                <Card className="mt-4 bg-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-base">AI Suggestion</CardTitle>
                        <CardDescription>We suggest a price between €{suggestion.minPrice} and €{suggestion.maxPrice}.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground italic">"{suggestion.reasoning}"</p>
                        <Button type="button" onClick={() => form.setValue('price', suggestion.recommendedPrice, { shouldValidate: true })} className="w-full">
                            Apply Recommended Price (€{suggestion.recommendedPrice})
                        </Button>
                    </CardContent>
                </Card>
            )}

             <div className="bg-muted rounded-lg p-4 flex flex-col justify-center">
                <FormLabel className="text-sm text-muted-foreground flex items-center">
                    You earn
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-4 w-4 ml-1">
                                    <Info className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                            <p>This is your estimated earning after a 20% commission and a €5 service fee are deducted.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </FormLabel>
                <p className="font-bold text-lg">€{earning.toFixed(2)}</p>
            </div>
            <p className="text-sm text-muted-foreground">The buyer will also pay for shipping. <a href="#" className="underline">Learn more</a></p>
          </form>
        </Form>
      
      <StepActions
          onNext={form.handleSubmit(onSubmit)}
          nextText="Continue to review"
          isNextDisabled={!priceValue || priceValue <= 0}
        />
    </div>
  );
}
