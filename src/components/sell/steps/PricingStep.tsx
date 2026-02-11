'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
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
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from '@/components/ui/input';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep5Schema } from '@/lib/types';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import { getPriceSuggestion } from '@/app/sell/actions';
import type { SuggestPriceOutput } from '@/ai/flows/ai-suggest-price';
import type { SimilarSoldItem } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Info, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type Step5Values = z.infer<typeof sellStep5Schema>;

const COMMISSION_RATE = 0.20;
const FIXED_FEE = 5;

const SimilarItemCard = ({ item }: { item: SimilarSoldItem }) => {
    const productImage = PlaceHolderImages.find((p) => p.id === item.image);
    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="relative aspect-square bg-muted">
                {productImage && <Image src={productImage.imageUrl} alt={item.title} fill sizes="150px" className="object-cover" />}
            </div>
            <div className="p-2 text-sm">
                <p className="font-bold">{item.brand}</p>
                <p className="text-muted-foreground truncate">{item.title}</p>
                <p className="font-semibold">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(item.price)}</p>
                <p className="text-xs text-muted-foreground">{item.soldDate}</p>
            </div>
        </div>
    )
}

export function PricingStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const [isAISuggestionLoading, setAISuggestionLoading] = useState(false);
  const [aiResult, setAIResult] = useState<SuggestPriceOutput | null>(null);
  const [earning, setEarning] = useState<number>(0);
  const { toast } = useToast();

  const form = useForm<Step5Values>({
    resolver: zodResolver(sellStep5Schema),
    defaultValues: {
      price: formData.price,
      currency: formData.currency || 'EUR',
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


  const onSubmit = (data: Step5Values) => {
    setFormData({ ...data, sellerEarning: earning });
    nextStep();
  };

  const handleGetSuggestion = async () => {
    setAISuggestionLoading(true);
    setAIResult(null);

    const dataForAI = {
      category: formData.category!,
      brand: formData.brand!,
      condition: formData.condition!,
      description: formData.description!,
      currency: form.getValues('currency'),
    }

    const response = await getPriceSuggestion(dataForAI);
    if (response.success && response.data) {
      setAIResult(response.data);
      form.setValue('price', response.data.suggestedPrice, { shouldValidate: true });
    } else {
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: response.error || 'There was a problem with the AI suggestion service.',
      });
    }
    setAISuggestionLoading(false);
  };
  
  const currencyFormatter = (value: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: form.getValues('currency') }).format(value);


  return (
    <div className="space-y-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <h3 className="font-semibold text-lg">Price</h3>
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                        <Input 
                            type="number" 
                            placeholder="e.g. 550" 
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                            value={field.value ?? ''} 
                            className="h-16 text-lg"
                         />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <div className="bg-muted rounded-lg p-2 flex flex-col justify-center">
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
                    <p className="font-bold text-lg">{currencyFormatter(earning)}</p>
                </div>
            </div>
            <p className="text-sm text-muted-foreground">The buyer will also pay a 7€ service fee. <a href="#" className="underline">Learn more</a></p>
            
            <Button type="button" onClick={handleGetSuggestion} disabled={isAISuggestionLoading} className="w-full" variant="outline">
                {isAISuggestionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                Suggest a price
            </Button>
            
          </form>
        </Form>
      
        {isAISuggestionLoading && (
             <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-6 w-32" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            </div>
        )}
        
        {aiResult && (
            <div className="space-y-6 animate-in fade-in-50">
                <Alert variant="default" className="bg-green-50 border-green-200 text-green-900">
                    <CheckCircle className="h-4 w-4 !text-green-600" />
                    <AlertTitle className="font-bold">High chance to sell</AlertTitle>
                    <AlertDescription>
                        Great chance to sell with our recommended price of {currencyFormatter(aiResult.suggestedPrice)}. <a href="#" className="underline font-semibold">Learn more</a>
                    </AlertDescription>
                </Alert>

                <div>
                    <h3 className="font-semibold text-lg">Similar sold items</h3>
                    <p className="text-sm text-muted-foreground">Filtered by {formData.condition?.replace('_', ' ')}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {(aiResult.similarSoldItems || []).map(item => (
                        <SimilarItemCard key={item.id} item={item} />
                    ))}
                </div>
            </div>
        )}
        
      <StepActions
          onNext={form.handleSubmit(onSubmit)}
          nextText="Continue to review"
          isNextDisabled={!priceValue || priceValue <= 0}
        />
    </div>
  );
}
