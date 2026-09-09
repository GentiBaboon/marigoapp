'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getCookie } from '@/lib/cookies';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

/**
 * The footer's newsletter sign-up.
 *
 * For a long time this was an input and a button with no handler — the
 * "Subscribe" did nothing at all. It now posts to `/api/newsletter/subscribe`
 * with the double-submit CSRF token, which middleware requires on every
 * cookie-authenticated `/api` mutation (a signed-out visitor has no Bearer
 * token to be exempted by), and replaces itself with a confirmation.
 */
export function NewsletterForm() {
  const [email, setEmail] = React.useState('');
  const [state, setState] = React.useState<State>({ kind: 'idle' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;

    setState({ kind: 'sending' });
    try {
      const csrf = getCookie('__csrf');
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify({ email: address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ kind: 'error', message: data?.error || 'Something went wrong. Please try again.' });
        return;
      }
      setState({ kind: 'done' });
    } catch {
      setState({ kind: 'error', message: 'Something went wrong. Please try again.' });
    }
  };

  if (state.kind === 'done') {
    return (
      <p className="text-sm text-foreground" role="status">
        You&apos;re on the list. Thanks for subscribing!
      </p>
    );
  }

  const sending = state.kind === 'sending';

  return (
    <form onSubmit={submit} className="w-full max-w-sm" noValidate>
      <div className="flex items-center space-x-2">
        <Input
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          disabled={sending}
          aria-label="Email address"
          aria-invalid={state.kind === 'error' || undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state.kind === 'error') setState({ kind: 'idle' });
          }}
        />
        <Button type="submit" disabled={sending || !email.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Subscribe'}
        </Button>
      </div>
      {state.kind === 'error' && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
