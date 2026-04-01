'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { confirmPasswordReset } from 'firebase/auth';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
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
import Link from 'next/link';

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type ResetValues = z.infer<typeof resetSchema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  const router = useRouter();
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(data: ResetValues) {
    if (!oobCode) {
      setError('Invalid or missing reset code. Please request a new reset link.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, data.password);
      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (err: any) {
      if (err.code === 'auth/invalid-action-code' || err.code === 'auth/expired-action-code') {
        setError('This reset link has expired or already been used. Please request a new one.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-3">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
        <h3 className="text-lg font-semibold">Password updated!</h3>
        <p className="text-sm text-muted-foreground">
          Your password has been changed. Redirecting you to sign in…
        </p>
      </div>
    );
  }

  if (!oobCode) {
    return (
      <div className="text-center space-y-3">
        <XCircle className="h-12 w-12 text-destructive mx-auto" />
        <h3 className="text-lg font-semibold">Invalid link</h3>
        <p className="text-sm text-muted-foreground">
          This reset link is invalid or has expired.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/auth/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="At least 8 characters" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Repeat your password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Set New Password
        </Button>
      </form>
    </Form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Card className="w-full max-w-md mx-auto mt-20">
      <CardHeader className="text-center">
        <CardTitle className="font-headline text-3xl">New Password</CardTitle>
        <CardDescription>Choose a strong password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
          <ResetPasswordForm />
        </Suspense>
        <div className="mt-4 text-center text-sm">
          <Link href="/auth/forgot-password" className="underline text-muted-foreground">
            Request a new link
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
