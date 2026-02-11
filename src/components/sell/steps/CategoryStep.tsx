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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSellForm } from '@/components/sell/SellFormContext';
import { sellStep1Schema } from '@/lib/types';
import type { z } from 'zod';
import { StepActions } from '@/components/sell/StepActions';
import { categories } from '@/lib/mock-data';

type Step1Values = z.infer<typeof sellStep1Schema>;

export function CategoryStep() {
  const { formData, setFormData, nextStep } = useSellForm();

  const form = useForm<Step1Values>({
    resolver: zodResolver(sellStep1Schema),
    defaultValues: {
      gender: formData.gender,
      category: formData.category,
    },
  });

  const onSubmit = (data: Step1Values) => {
    setFormData(data);
    nextStep();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category</CardTitle>
        <CardDescription>
          First, tell us about the basic category of your item.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Who is this for?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col sm:flex-row sm:flex-wrap gap-4"
                    >
                      {['Women', 'Men', 'Children', 'Unisex'].map((gender) => (
                        <FormItem
                          key={gender}
                          className="flex items-center space-x-3 space-y-0"
                        >
                          <FormControl>
                            <RadioGroupItem value={gender.toLowerCase()} />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {gender}
                          </FormLabel>
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.slug}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
