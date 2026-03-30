'use client';

import { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { useUser } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not signed in', description: 'Please sign in first.' });
      return;
    }
    setResending(true);
    try {
      await sendEmailVerification(user);
      toast({ title: 'Email sent', description: 'A new verification link has been sent to your email.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to send', description: 'Please try again later.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-20 text-center">
      <CardHeader>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="font-headline text-3xl mt-4">
          Verify Your Email
        </CardTitle>
        <CardDescription>
          We've sent a verification link to your email address. Please check your
          inbox and follow the link to complete your registration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Didn't receive an email?{' '}
          <Button variant="link" className="p-0 h-auto underline" onClick={handleResend} disabled={resending}>
            {resending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Resend verification link
          </Button>
        </p>
        <p className="text-sm text-muted-foreground">
          <Link href="/auth/login" className="underline">
            Back to Sign In
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
