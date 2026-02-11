import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginForm } from '@/components/auth/login-form';
import { SignupForm } from '@/components/auth/signup-form';
import { SocialButtons } from '@/components/auth/social-buttons';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default function AuthenticationPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <Link href="/" className="flex items-center justify-center space-x-2">
            <span className="inline-block font-logo font-bold text-3xl bg-gradient-to-r from-primary to-purple-400 text-transparent bg-clip-text">
              marigo
            </span>
          </Link>
        <CardTitle className="font-headline text-2xl pt-4">
          Welcome to the Marketplace
        </CardTitle>
        <CardDescription>
          Sign in to continue or create an account to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="space-y-6">
            <div className="pt-6">
              <LoginForm />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <SocialButtons />
          </TabsContent>
          <TabsContent value="signup" className="space-y-6">
            <div className="pt-6">
             <SignupForm />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <SocialButtons />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
