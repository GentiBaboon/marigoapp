'use client';

import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { SocialButtons } from '@/components/auth/social-buttons';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

/**
 * The `next` destination is read on the client rather than from the server's
 * `searchParams` prop. The native bundle is a static export with no request
 * behind it, so that prop is always empty there and the post-auth redirect
 * target would be silently dropped on device.
 */
export function LoginContent() {
  const next = useSearchParams().get('next') ?? undefined;
  const signupHref = next ? `/auth/signup?next=${encodeURIComponent(next)}` : '/auth/signup';

  return (
    <div className="relative flex flex-1 flex-col justify-center bg-background px-6 py-8">
        <Button asChild variant="ghost" size="icon" className="absolute top-4 right-4 z-10">
            <Link href="/auth">
                <X className="h-6 w-6" />
            </Link>
        </Button>
        <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-6">
              <h1 className="font-headline text-3xl">Sign In</h1>
              <p className="text-muted-foreground mt-2">Welcome back! Enter your details to sign in.</p>
            </div>
            <div className="space-y-5">
                <LoginForm />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or sign in with
                    </span>
                  </div>
                </div>
                <SocialButtons />
                <div className="text-center text-sm">
                  Don&apos;t have an account?{' '}
                  <Link href={signupHref} className="underline">
                    Sign Up
                  </Link>
                </div>
            </div>
        </div>
    </div>
  );
}
