import { LoginForm } from '@/components/auth/login-form';
import { SocialButtons } from '@/components/auth/social-buttons';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-background p-8 flex flex-col justify-center">
        <Button asChild variant="ghost" size="icon" className="absolute top-4 right-4 z-10">
            <Link href="/auth">
                <X className="h-6 w-6" />
            </Link>
        </Button>
        <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-8">
              <h1 className="font-headline text-3xl">Sign In</h1>
              <p className="text-muted-foreground mt-2">Welcome back! Enter your details to sign in.</p>
            </div>
            <div className="space-y-6">
                <LoginForm />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or sign in with
                    </span>
                  </div>
                </div>
                <SocialButtons />
                <div className="mt-4 text-center text-sm">
                  Don&apos;t have an account?{' '}
                  <Link href="/auth/signup" className="underline">
                    Sign Up
                  </Link>
                </div>
            </div>
        </div>
    </div>
  );
}
