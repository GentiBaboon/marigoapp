import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <Card className="w-full max-w-md text-center">
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
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Didn't receive an email?{' '}
          <Link href="#" className="underline">
            Resend verification link
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
