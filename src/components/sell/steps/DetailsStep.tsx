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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep2Schema } from '@/lib/types';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import { brands, productColors, productConditions, productMaterials } from '@/lib/mock-data';
import { Combobox } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

type Step2Values = z.infer<typeof sellStep2Schema>;

export function DetailsStep() {
  const { formData, setFormData, nextStep } = useSellForm();

  const form = useForm<Step2Values>({
    resolver: zodResolver(sellStep2Schema),
    defaultValues: {
      brand: formData.brand || '',
      condition: formData.condition,
      color: formData.color,
      material: formData.material || ''
    },
  });

  const onSubmit = (data: Step2Values) => {
    setFormData(data);
    nextStep();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Item Details</CardTitle>
        <CardDescription>Provide more specific details about your item.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <Combobox
                       items={brands.map(b => ({ value: b.slug, label: b.name }))}
                       placeholder="Select brand"
                       searchPlaceholder="Search for a brand..."
                       emptyPlaceholder="No brand found."
                       value={field.value}
                       onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color: <span className="font-normal text-muted-foreground">{field.value}</span></FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                        {productColors.map((color) => (
                            <Button
                            key={color.name}
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn('rounded-full h-8 w-8', {
                                'ring-2 ring-primary ring-offset-2': field.value === color.name,
                            })}
                            onClick={() => field.onChange(color.name)}
                            >
                            <div
                                className="h-6 w-6 rounded-full border"
                                style={{ backgroundColor: color.hex }}
                            ></div>
                            <span className="sr-only">{color.name}</span>
                            </Button>
                        ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="material"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Lambskin Leather" {...field} />
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
