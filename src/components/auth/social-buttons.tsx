'use client';

import { useEffect, useState } from 'react';
import { useAppRouter as useRouter } from '@/lib/platform/use-app-router';
import { Loader2 } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase';
import { postLoginDestination } from '@/firebase/auth/post-login';
import { SUSPENDED_MESSAGE } from '@/lib/account-verification';
import { usePostAuthRedirect } from '@/hooks/use-post-auth-redirect';
import { signInWithGoogle, completeOAuthRedirect } from '@/firebase/auth/actions';
import { useToast } from '@/hooks/use-toast';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IS_NATIVE_BUILD } from '@/lib/platform/native';

/**
 * Whether to offer Google sign-in at all on this build.
 *
 * Sign in with Apple was withdrawn from the website on 2026-09-08 — the
 * button is gone, `signInWithApple` in `firebase/auth/actions.ts` is kept so
 * it can come back without being rewritten. An account that was created with
 * Apple can no longer sign in until it does; none is known to exist.
 *
 * Off in the native bundle. Neither provider can complete inside a WebView:
 * Google refuses OAuth from an embedded browser outright (`disallowed_useragent`,
 * their anti-phishing policy since 2016), and the app initialises Auth without a
 * popupRedirectResolver anyway — that resolver is what used to hang and stall
 * every Firestore query, so it is not coming back. Showing buttons that can only
 * ever fail is worse than not showing them, and App Store guideline 4.8 only
 * demands Sign in with Apple when some *other* third-party sign-in is on offer,
 * so hiding both keeps that requirement out of play too.
 *
 * A build-time constant, not a runtime check: the native bundle then never
 * contains the markup, so there is no flash of a button that vanishes on
 * hydration. Email and password sign-in is unaffected on every platform.
 *
 * Restoring these on device means @capacitor-firebase/authentication, which
 * signs in through the native SDKs instead of the WebView.
 */
export const SOCIAL_SIGN_IN_AVAILABLE = !IS_NATIVE_BUILD;

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>Google</title>
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.36 1.95-4.25 1.95-3.52 0-6.43-2.91-6.43-6.48s2.91-6.48 6.43-6.48c2.03 0 3.36.85 4.18 1.62l2.52-2.52C17.96 1.68 15.46 0 12.48 0 5.88 0 0 5.88 0 12.48s5.88 12.48 12.48 12.48c6.94 0 12.02-4.74 12.02-12.24 0-.77-.07-1.52-.2-2.32H12.48z" />
  </svg>
);

export function SocialButtons({ variant = 'outline', className }: { variant?: ButtonProps['variant'], className?: string}) {
  const [loading, setLoading] = useState<null | 'google'>(null);
  // True while a returning redirect is being claimed, so the buttons stay
  // disabled instead of inviting a second sign-in on top of one completing.
  const [resumingRedirect, setResumingRedirect] = useState(true);
  const router = useRouter();
  const nextPath = usePostAuthRedirect();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  // Claims the credential waiting after a full-page redirect. Without this the
  // redirect path is a dead end — the provider sends the user back, Firebase is
  // holding the result, and the sign-in screen simply renders again as though
  // nothing happened. Resolves to nothing on a normal visit.
  useEffect(() => {
    let cancelled = false;
    completeOAuthRedirect(auth)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.user) {
          postLoginDestination(firestore, auth, result.user, nextPath).then((outcome) => {
            if (cancelled) return;
            if (outcome.kind === 'go') router.push(outcome.to);
            else toast({ variant: 'destructive', title: 'Account suspended', description: SUSPENDED_MESSAGE });
          });
          return;
        }
        if (result.error) {
          toast({
            variant: 'destructive',
            title: 'Sign in failed',
            description: result.error,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setResumingRedirect(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, firestore, router, nextPath, toast]);

  const handleSocialLogin = async (provider: 'google') => {
    setLoading(provider);
    try {
      const result = await signInWithGoogle(auth);

      if (result.success && result.user) {
        const outcome = await postLoginDestination(firestore, auth, result.user, nextPath);
        if (outcome.kind === 'go') router.push(outcome.to);
        else toast({ variant: 'destructive', title: 'Account suspended', description: SUSPENDED_MESSAGE });
        setLoading(null);
        return;
      }

      if (result.redirecting) {
        // The browser is on its way to the provider. There is no outcome to
        // report, and the spinner deliberately stays up: clearing it would
        // flash the buttons back to idle in the instant before the page goes.
        return;
      }

      toast({
        variant: 'destructive',
        title: `Sign in with ${
          provider.charAt(0).toUpperCase() + provider.slice(1)
        } failed`,
        description: result.error,
      });
      setLoading(null);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: 'An unexpected error occurred. Please try again.',
      });
      setLoading(null);
    }
  };

  // Belt and braces: callers also hide the surrounding divider, but a caller
  // that forgets should still render nothing rather than dead buttons.
  if (!SOCIAL_SIGN_IN_AVAILABLE) return null;

  return (
    <div className="space-y-4">
      <Button
        variant={variant}
        className={cn("w-full", className)}
        onClick={() => handleSocialLogin('google')}
        disabled={!!loading || resumingRedirect}
      >
        {loading === 'google' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="mr-2 h-4 w-4" />
        )}
        Continue with Google
      </Button>
    </div>
  );
}
