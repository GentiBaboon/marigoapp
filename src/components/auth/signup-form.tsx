'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';
import { Loader2 } from 'lucide-react';

import { signupSchema, type SignupValues } from '@/lib/types';
import { useAuth } from '@/firebase';
import { usePostAuthRedirect, useRedirectIfSignedIn } from '@/hooks/use-post-auth-redirect';
import { signUpWithEmail } from '@/firebase/auth/actions';
import { VerifyOtpStep } from './verify-otp-step';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';

/**
 * Sign-up is two screens behind one component.
 *
 *  `form`     collecting name / email / password
 *  `creating` the Firebase account is being created
 *  `verify`   the account exists but is not activated — enter the emailed code
 *
 * The stage is what keeps `useRedirectIfSignedIn` quiet: creating the account
 * signs the user in, and the redirect that normally follows would carry them
 * past the code entry box into the app. It is switched off *before* the call
 * that creates the account, not after it resolves, so no auth state change can
 * slip through the gap.
 */
export type Stage = 'form' | 'creating' | 'verify';

export function SignupForm({ onStageChange }: { onStageChange?: (stage: Stage) => void } = {}) {
  const [stage, setStageRaw] = useState<Stage>('form');
  // The surrounding screen hides its social buttons and "already have an
  // account?" link once verification starts — offering a third way in beside a
  // half-created account is how someone ends up with two.
  const setStage = (next: Stage) => {
    setStageRaw(next);
    onStageChange?.(next);
  };
  const [pending, setPending] = useState<{ email: string; name: string } | null>(null);
  const router = useRouter();
  // Post-auth destination, validated same-origin so an attacker can't
  // open-redirect a freshly-signed-up user to an external phishing URL.
  const nextPath = usePostAuthRedirect();
  useRedirectIfSignedIn(stage === 'form');
  const auth = useAuth();
  const { toast } = useToast();
  const loading = stage === 'creating';

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      terms: false,
    },
  });

  async function onSubmit(data: SignupValues) {
    setStage('creating');
    const result = await signUpWithEmail(auth, data.email, data.password, data.name);
    if (result.success && result.user) {
      // Signed in, but not yet activated. The code is requested by
      // VerifyOtpStep on mount rather than here, so a resend and the first
      // send go down exactly one path.
      setPending({ email: data.email, name: data.name });
      setStage('verify');
      return;
    }
    toast({
      variant: 'destructive',
      title: 'Sign up failed',
      description: result.error,
    });
    setStage('form');
  }

  /**
   * They mistyped the address.
   *
   * The Firebase account is deleted rather than abandoned, because an
   * abandoned one still *holds* the typo'd address: the person can never
   * correct it to that address later, and `auth/email-already-in-use` is what
   * they would be told if the typo happened to be someone else's real inbox.
   * `delete()` needs a recent sign-in, which is why it is offered here and not
   * from some later screen; if it is refused anyway, signing out at least
   * returns them to a form they can use.
   *
   * The `users/{uid}` document the provider bootstrapped is left behind —
   * Firestore rules grant no delete on it. It is inert (nothing can
   * authenticate as that uid again) and stays `emailVerified: false`, which is
   * what makes such strays findable in admin.
   */
  async function handleUseAnotherEmail() {
    const current = auth?.currentUser;
    try {
      if (current) await current.delete();
    } catch {
      await auth?.signOut().catch(() => undefined);
    }
    setPending(null);
    setStage('form');
    form.reset();
  }

  if (stage === 'verify' && pending) {
    return (
      <VerifyOtpStep
        email={pending.email}
        name={pending.name}
        onVerified={() => router.push(nextPath)}
        onUseAnotherEmail={handleUseAnotherEmail}
      />
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 !mt-6">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Accept terms and conditions</FormLabel>
                <FormDescription>
                  You agree to our{' '}
                  <Link href="/terms" className="underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="underline">
                    Privacy Policy
                  </Link>
                  .
                </FormDescription>
                 <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={loading} className="w-full !mt-8">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account
        </Button>
      </form>
    </Form>
  );
}
