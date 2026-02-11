'use client';
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
import { productSizes } from '@/lib/mock-data';

type Step4Values = z.infer<typeof sellStep4Schema>;

export function DescriptionStep() {
  const { formData, setFormData, nextStep } = useSellForm();

  const form = useForm<Step4Values>({
    resolver: zodResolver(sellStep4Schema),
    defaultValues: {
      title: formData.title || '',
      description: formData.description || '',
      size: formData.size,
    },
  });

  const onSubmit = (data: Step4Values) => {
    setFormData(data);
    nextStep();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Title & Description</CardTitle>
        <CardDescription>
          Give your item a great title and a detailed description.
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
                  <FormLabel>Description</FormLabel>
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
             <FormField
              control={form.control}
              name="size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Size</FormLabel>
                   <FormControl>
                     <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-wrap gap-2"
                      >
                        {productSizes.map((size) => (
                           <FormItem key={size} className="flex items-center">
                             <FormControl>
                                <RadioGroupItem value={size} id={`size-${size}`} className="sr-only" />
                             </FormControl>
                             <Label
                              htmlFor={`size-${size}`}
                              className={cn(
                                "flex items-center justify-center rounded-md border text-sm font-medium p-2 h-9 w-12 cursor-pointer hover:bg-accent hover:text-accent-foreground",
                                field.value === size && "bg-primary text-primary-foreground hover:bg-primary/90"
                              )}
                             >
                               {size}
                             </Label>
                           </FormItem>
                        ))}
                      </RadioGroup>
                   </FormControl>
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
