'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/types';
import { useAuth } from '@/firebase';
import { sendPasswordReset } from '@/firebase/auth/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const auth = useAuth();
  const { toast } = useToast();

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(data: ForgotPasswordValues) {
    setLoading(true);
    const result = await sendPasswordReset(auth, data.email);
    if (result.success) {
      setSubmitted(true);
    } else {
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description:
          result.error ||
          'There was a problem sending the password reset email.',
      });
    }
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-medium">Check your email</h3>
        <p className="text-sm text-muted-foreground mt-2">
          If an account with that email exists, we've sent it a link to reset
          the password.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send Reset Link
        </Button>
      </form>
    </Form>
  );
}
