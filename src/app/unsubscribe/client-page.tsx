'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MailX, CheckCircle2, AlertTriangle } from 'lucide-react';

type State = 'idle' | 'working' | 'done' | 'error' | 'invalid';

export default function UnsubscribeClient() {
  const params = useSearchParams();
  const token = params.get('u') ?? '';
  const [state, setState] = React.useState<State>(token ? 'idle' : 'invalid');
  const [message, setMessage] = React.useState('');

  /**
   * Deliberately *not* done on page load. Mail clients and security scanners
   * prefetch links, so an unsubscribe that fired on GET would opt people out
   * of mail they never asked to stop receiving. The RFC 8058 header handles
   * genuine one-click; a human clicking through confirms here.
   */
  const confirm = async () => {
    setState('working');
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setState('done');
      } else {
        setState(res.status === 400 ? 'invalid' : 'error');
        setMessage(data?.error || 'Something went wrong.');
      }
    } catch {
      setState('error');
      setMessage('We could not reach the server. Please try again.');
    }
  };

  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12">
      <Card className="w-full">
        {state === 'done' ? (
          <>
            <CardHeader>
              <CheckCircle2 className="h-9 w-9 text-green-600" />
              <CardTitle className="pt-2">You&apos;re unsubscribed</CardTitle>
              <CardDescription>
                You will no longer receive offer alerts, message notifications or other
                non-essential emails from Marigo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Said plainly, because quietly continuing to send receipts after
                  someone clicked "unsubscribe" is what makes people report mail
                  as spam. */}
              <p className="text-sm text-muted-foreground">
                You will still receive essential emails about your orders, payments and account
                security — we cannot switch those off without breaking things you rely on, like
                order receipts and password resets.
              </p>
              <p className="text-sm text-muted-foreground">
                Changed your mind? You can turn notifications back on any time from your{' '}
                <Link href="/profile/settings" className="underline">
                  notification settings
                </Link>
                .
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/home">Back to Marigo</Link>
              </Button>
            </CardContent>
          </>
        ) : state === 'invalid' ? (
          <>
            <CardHeader>
              <AlertTriangle className="h-9 w-9 text-amber-500" />
              <CardTitle className="pt-2">This link isn&apos;t valid</CardTitle>
              <CardDescription>
                It may have been altered, or it may be from a very old email.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You can manage every email preference from your account instead.
              </p>
              <Button asChild className="w-full">
                <Link href="/profile/settings">Open notification settings</Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <MailX className="h-9 w-9 text-muted-foreground" />
              <CardTitle className="pt-2">Unsubscribe from Marigo emails</CardTitle>
              <CardDescription>
                Confirm below and we will stop sending non-essential emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This stops offer alerts, new-message notifications, listing updates and
                announcements. Essential emails about your orders, payments and account security
                will still be sent.
              </p>
              {state === 'error' && <p className="text-sm text-destructive">{message}</p>}
              <Button className="w-full" onClick={confirm} disabled={state === 'working'}>
                {state === 'working' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MailX className="mr-2 h-4 w-4" />
                )}
                Unsubscribe
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/home">Cancel</Link>
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
