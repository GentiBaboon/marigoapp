'use client';
import { CourierApplicationForm } from '@/components/courier/CourierApplicationForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CourierApplyPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/auth');
        }
    }, [user, isUserLoading, router]);

    if (isUserLoading || !user) {
        return (
             <div className="flex h-[calc(100vh-8rem)] w-screen items-center justify-center bg-background">
                <div className="dot-flashing"></div>
            </div>
        );
    }
    
    if (user.isCourier) {
         return (
             <div className="container mx-auto py-8 px-4 max-w-lg">
                 <Card>
                     <CardHeader>
                        <CardTitle>Application Submitted</CardTitle>
                        <CardDescription>
                            Your application is currently under review. We'll notify you once a decision has been made.
                        </CardDescription>
                     </CardHeader>
                     <CardContent>
                        <Button asChild>
                            <Link href="/profile">Go to Profile</Link>
                        </Button>
                     </CardContent>
                 </Card>
             </div>
         );
    }

    return (
        <div className="container mx-auto max-w-2xl py-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Courier Application</CardTitle>
                    <CardDescription>
                        Complete the form below to become a delivery partner.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CourierApplicationForm />
                </CardContent>
            </Card>
        </div>
    )
}
