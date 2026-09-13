'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SignupForm, type Stage } from '@/components/auth/signup-form';
import {
  SocialButtons,
} from '@/components/auth/social-buttons';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

/**
 * The `next` destination is read on the client rather than from the server's
 * `searchParams` prop — see the sibling login screen for why.
 */
export function SignupContent() {
  // Preserve the post-auth redirect target across the signup ↔ login link so
  // users who hit signup first don't lose their original destination.
  const next = useSearchParams().get('next') ?? undefined;
  const loginHref = next ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login';
  // Once the form hands over to the activation step there is a half-created
  // account in play, so every other route into one is taken off the screen.
  const [stage, setStage] = useState<Stage>('form');
  const verifying = stage === 'verify';

  return (
     <div className="relative flex flex-1 flex-col justify-center bg-background px-6 py-8">
        <Button asChild variant="ghost" size="icon" className="absolute top-4 right-4 z-10">
            <Link href="/auth">
                <X className="h-6 w-6" />
            </Link>
        </Button>
        <div className="w-full max-w-md mx-auto">
            {!verifying && (
              <div className="text-center mb-6">
                <h1 className="font-headline text-3xl">Create an Account</h1>
                <p className="text-muted-foreground mt-2">Join our community of fashion lovers.</p>
              </div>
            )}
            <div className="space-y-5">
                <SignupForm onStageChange={setStage} />
                {!verifying && (
                <>
                {/* See login-content.tsx — the divider lives inside the
                    component so it cannot outlive the buttons it introduces. */}
                <SocialButtons divider="Or sign up with" />
                <div className="text-center text-sm">
                  Already have an account?{' '}
                  <Link href={loginHref} className="underline">
                    Sign In
                  </Link>
                </div>
                </>
                )}
            </div>
        </div>
    </div>
  );
}
