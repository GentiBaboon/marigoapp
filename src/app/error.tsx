'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to monitoring service (Sentry, etc.)
    import('@/lib/error-reporter').then(({ reportError }) => {
      reportError(error, { source: 'error-boundary', extra: { digest: error.digest } });
    });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle className="font-headline text-3xl">
            Something went wrong!
          </CardTitle>
          <CardDescription>
            We're sorry, but an unexpected error occurred. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => reset()}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
