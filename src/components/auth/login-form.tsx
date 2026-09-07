'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

import { loginSchema, type LoginValues } from '@/lib/types';
import { useAuth, useFirestore } from '@/firebase';
import { usePostAuthRedirect, useRedirectIfSignedIn } from '@/hooks/use-post-auth-redirect';
import { signInWithEmail } from '@/firebase/auth/actions';
import { postLoginDestination } from '@/firebase/auth/post-login';
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

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const nextPath = usePostAuthRedirect();
  // Someone who is already signed in should never be shown this form.
  useRedirectIfSignedIn();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginValues) {
    setLoading(true);
    const result = await signInWithEmail(auth, data.email, data.password);
    if (result.success && result.user) {
      // An account that never entered its activation code is sent to the
      // code screen, not into the app — see post-login.ts.
      router.push(await postLoginDestination(firestore, result.user, nextPath));
    } else {
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: result.error,
      });
    }
    setLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="text-right text-sm">
          <Link
            href="/auth/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            Forgot Password?
          </Link>
        </div>
        <Button type="submit" disabled={loading} className="w-full !mt-6">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>
    </Form>
  );
}
