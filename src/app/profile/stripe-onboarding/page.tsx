'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function StripeOnboardingPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const functions = getFunctions();

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/auth');
        }
    }, [user, isUserLoading, router]);

    const handleOnboarding = async () => {
        setIsLoading(true);
        try {
            const createStripeConnectedAccount = httpsCallable(functions, 'createStripeConnectedAccount');
            const result: any = await createStripeConnectedAccount();
            const { url } = result.data;
            if (url) {
                window.location.href = url;
            } else {
                throw new Error("Could not get onboarding URL.");
            }
        } catch (error: any) {
            console.error("Stripe onboarding error:", error);
            toast({
                variant: 'destructive',
                title: "Onboarding Failed",
                description: error.message || "Could not start the Stripe onboarding process. Please try again."
            });
            setIsLoading(false);
        }
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Set up Payouts with Stripe</CardTitle>
                    <CardDescription>
                        Marigo partners with Stripe for secure financial services. Click the button below to set up your account and start getting paid for your sales.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <p>You'll be redirected to Stripe to provide necessary information, such as:</p>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                            <li>Your personal or business details</li>
                            <li>Bank account information for payouts</li>
                        </ul>
                        <p>This process is secure and your sensitive information is never stored on our servers.</p>
                        <Button onClick={handleOnboarding} disabled={isLoading || isUserLoading} className="w-full" size="lg">
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Continue to Stripe
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
