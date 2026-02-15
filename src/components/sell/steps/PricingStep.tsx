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
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from '@/components/ui/input';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep6Schema } from '@/lib/types';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

type Step6Values = z.infer<typeof sellStep6Schema>;

const COMMISSION_RATE = 0.20;
const FIXED_FEE = 5;

export function PricingStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const [earning, setEarning] = useState<number>(0);

  const form = useForm<Step6Values>({
    resolver: zodResolver(sellStep6Schema),
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

  const onSubmit = (data: Step6Values) => {
    setFormData({ ...data, sellerEarning: earning });
    nextStep();
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
