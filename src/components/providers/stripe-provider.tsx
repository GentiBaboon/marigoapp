'use client';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useEffect, useState, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Initialize Stripe outside of the component to avoid re-creation
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function StripeProvider({ children }: { children: ReactNode }) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return null;
    }

    if (!publishableKey || publishableKey === 'pk_test_your_key_here') {
        return (
            <div className="container mx-auto p-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Stripe Configuration Missing</AlertTitle>
                    <AlertDescription>
                        The Stripe Publishable Key is not configured. Please add <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to your <code>.env</code> file.
                    </AlertDescription>
                </Alert>
                <div className="mt-4 opacity-50 pointer-events-none">
                    {children}
                </div>
            </div>
        );
    }

    return (
        <Elements stripe={stripePromise}>
            {children}
        </Elements>
    );
}
