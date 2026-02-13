'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/firebase';
import { signInWithGoogle, signInWithApple } from '@/firebase/auth/actions';
import { useToast } from '@/hooks/use-toast';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

const AppleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>Apple</title>
    <path d="M12.032 17.84a5.053 5.053 0 0 1-2.203-1.636c-1.393-1.353-2.313-3.64-2.313-6.196 0-2.954 1.32-5.432 3.235-5.432 1.03 0 2.03.62 2.793 1.565-1.12.986-1.681 2.37-1.681 3.867 0 1.64.63 2.918 1.83 3.753-1.079 1.65-2.502 2.91-4.66 3.079zM19.78 12.72c.036-.18.06-.363.06-.546 0-3.35-2.05-5.918-4.99-5.918-1.079 0-2.312.63-3.34 1.595-1.176 1.048-2.051 2.58-2.051 4.355 0 3.32 2.22 6.095 5.038 6.095 1.032 0 2.21-.59 3.23-1.595a.8.8 0 0 0 .15-.75 3.518 3.518 0 0 0-1.118-1.22.821.821 0 0 0-.826-.01c-.3.17-2.03 1.25-2.03 3.38.01 1.01.44 1.83.88 2.31-1.03.6-2.1.9-3.21.9-3.13 0-6.28-2.22-6.28-6.09 0-3.58 2.62-5.83 5.38-5.83 2.54 0 4.14 1.74 4.14 1.74a5.454 5.454 0 0 1-3.67 1.48c.03.01.06.01.09.01 2.27 0 3.92-1.48 3.92-3.68a.86.86 0 0 0-.05-.33c1.03-.07 2.31-.63 3.19-1.95a10.95 10.95 0 0 0-3.79 5.86z" />
  </svg>
);

export function SocialButtons({ variant = 'outline', className }: { variant?: ButtonProps['variant'], className?: string}) {
  const [loading, setLoading] = useState<null | 'google' | 'apple'>(null);
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    const action = provider === 'google' ? signInWithGoogle : signInWithApple;
    const result = await action(auth);

    if (result.success) {
      router.push('/home');
    } else {
      toast({
        variant: 'destructive',
        title: `Sign in with ${
          provider.charAt(0).toUpperCase() + provider.slice(1)
        } failed`,
        description: result.error,
      });
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
       <Button
        variant={variant}
        className={cn("w-full", className)}
        onClick={() => handleSocialLogin('apple')}
        disabled={!!loading}
      >
        {loading === 'apple' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <AppleIcon className="mr-2 h-4 w-4 fill-current" />
        )}
        Continue with Apple
      </Button>
      <Button
        variant={variant}
        className={cn("w-full", className)}
        onClick={() => handleSocialLogin('google')}
        disabled={!!loading}
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
