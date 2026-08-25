'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { OtpInput } from './otp-input';

/**
 * The activation step: enter the 6-digit code, and the account goes live.
 *
 * Deliberately self-contained — it takes an email and a callback and owns
 * everything else — so the sign-up form and `/auth/verify-email` can both
 * mount it without either of them learning the protocol.
 *
 * It talks to `/api/auth/{send,verify}-otp` with a Bearer ID token, which the
 * middleware exempts from CSRF (a token the attacker cannot read is already
 * proof of intent, and there is no ambient cookie authority to forge).
 */
/** Distinguishes "your session went away" from "the network is down" — they
 *  need different things from the user, and one message for both sends people
 *  to retry something that will never work. */
class SignedOutError extends Error {}

export function VerifyOtpStep({
  email,
  name,
  onVerified,
  onUseAnotherEmail,
}: {
  email: string;
  name?: string;
  onVerified: () => void;
  onUseAnotherEmail?: () => void;
}) {
  const auth = useAuth();
  const { toast } = useToast();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  // React 18 StrictMode mounts effects twice in development. Without this the
  // first code is superseded by a second one before the user has read either,
  // and the one in their inbox no longer works.
  const requested = useRef(false);

  const authedFetch = useCallback(
    async (path: string, body?: unknown) => {
      const user = auth?.currentUser;
      if (!user) throw new SignedOutError();
      const token = await user.getIdToken();
      const res = await fetch(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data } as const;
    },
    [auth],
  );

  const send = useCallback(
    async (isResend: boolean) => {
      setSending(true);
      setError(null);
      try {
        const { ok, data } = await authedFetch('/api/auth/send-otp');
        if (data?.alreadyVerified) {
          onVerified();
          return;
        }
        if (!ok) {
          const wait = Number(data?.retryAfterSeconds) || 0;
          if (wait) setCooldown(wait);
          setError(data?.error ?? 'We could not send the code.');
          return;
        }
        setCooldown(60);
        if (isResend) {
          toast({ title: 'Code sent', description: `A new code is on its way to ${email}.` });
        }
      } catch (err) {
        setError(
          err instanceof SignedOutError
            ? 'Your session ended. Sign in again to finish activating your account.'
            : 'Network error. Check your connection and try again.',
        );
      } finally {
        setSending(false);
      }
    },
    [authedFetch, email, onVerified, toast],
  );

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void send(false);
  }, [send]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = useCallback(
    async (submitted: string) => {
      if (submitted.length !== 6 || verifying) return;
      setVerifying(true);
      setError(null);
      try {
        const { ok, data } = await authedFetch('/api/auth/verify-otp', { code: submitted });
        if (ok && (data?.verified || data?.alreadyVerified)) {
          onVerified();
          return;
        }
        setError(data?.error ?? 'That code is not correct.');
        setAttemptsLeft(
          typeof data?.attemptsRemaining === 'number' ? data.attemptsRemaining : null,
        );
        // Clear the boxes so the next attempt starts from an empty field
        // rather than requiring six backspaces.
        setCode('');
      } catch (err) {
        setError(
          err instanceof SignedOutError
            ? 'Your session ended. Sign in again to finish activating your account.'
            : 'Network error. Check your connection and try again.',
        );
      } finally {
        setVerifying(false);
      }
    },
    [authedFetch, onVerified, verifying],
  );

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-headline text-2xl">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
          Enter it below to activate your account.
        </p>
      </div>

      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={submit}
        disabled={verifying}
        autoFocus
      />

      {error && (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
          {attemptsLeft !== null && attemptsLeft > 0 && (
            <span className="block text-muted-foreground">
              {attemptsLeft} {attemptsLeft === 1 ? 'attempt' : 'attempts'} remaining.
            </span>
          )}
        </p>
      )}

      <Button
        type="button"
        className="w-full"
        disabled={code.length !== 6 || verifying}
        onClick={() => submit(code)}
      >
        {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Activate my account
      </Button>

      <div className="text-center text-sm text-muted-foreground space-y-1">
        <p>
          Didn&apos;t get it?{' '}
          <Button
            variant="link"
            className="p-0 h-auto underline"
            disabled={sending || cooldown > 0}
            onClick={() => void send(true)}
          >
            {sending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </Button>
        </p>
        <p className="text-xs">Check your spam folder — the code expires in 10 minutes.</p>
        {onUseAnotherEmail && (
          <Button variant="link" className="p-0 h-auto text-xs underline" onClick={onUseAnotherEmail}>
            Use a different email address
          </Button>
        )}
      </div>
    </div>
  );
}
