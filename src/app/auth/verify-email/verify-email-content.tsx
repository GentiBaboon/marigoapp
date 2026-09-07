'use client';

import { useUser } from '@/firebase/provider';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';
import { usePostAuthRedirect } from '@/hooks/use-post-auth-redirect';
import { VerifyOtpStep } from '@/components/auth/verify-otp-step';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

/**
 * The way back into an unfinished sign-up.
 *
 * The code entry box normally lives inside the sign-up form, but a browser
 * gets closed between "create account" and "check your email". The account
 * exists and is signed in at that point, so this screen mounts the same step
 * and requests a fresh code — the old one has almost certainly expired anyway.
 *
 * Three things send people here: the sign-in form (`post-login.ts`), the
 * `RequireVerifiedEmail` gate in front of checkout / sell / messages, and an
 * API route's 403. All carry `?next=` so the member lands back where they
 * were going, not on the homepage.
 *
 * It renders the shared component rather than reimplementing the calls, so the
 * cooldown, attempt counter and resend behaviour cannot drift from the sign-up
 * path. An account that is already confirmed is answered `alreadyVerified` by
 * the first send and moved on without seeing a keypad.
 */
export function VerifyEmailContent() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const nextPath = usePostAuthRedirect();

  if (isUserLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.email) {
    return (
      <Card className="w-full max-w-md mx-auto mt-20 text-center">
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign in first, and we&apos;ll send your activation code.
          </p>
          <Button asChild>
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-20">
      <CardContent className="pt-6">
        <VerifyOtpStep
          email={user.email}
          name={user.displayName ?? undefined}
          onVerified={() => router.replace(nextPath)}
        />
      </CardContent>
    </Card>
  );
}
