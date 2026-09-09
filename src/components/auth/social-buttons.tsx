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

// Google's own four-colour "G", as specified in their sign-in branding
// guidelines — not a monochrome glyph, which people do not recognise as the
// button they see everywhere else. Fixed fills, so a coloured parent must not
// pass `fill-current`.
const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    role="img"
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>Google</title>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
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
          <GoogleIcon className="mr-2 h-[18px] w-[18px]" />
        )}
        Continue with Google
      </Button>
    </div>
  );
}
