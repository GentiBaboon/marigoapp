'use client';
import * as React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FirestoreDelivery } from '@/lib/types';
import { MapPin, Box, CircleDollarSign, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

interface JobCardProps {
    job: FirestoreDelivery;
}

export function JobCard({ job }: JobCardProps) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);

    const handleAcceptJob = async () => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'You must be logged in.' });
            return;
        }

        setIsLoading(true);
        const jobRef = doc(firestore, 'deliveries', job.id);

        try {
            await updateDoc(jobRef, {
                courierId: user.uid,
                status: 'assigned',
            });
            toast({
                title: 'Job Accepted!',
                description: 'The delivery has been assigned to you.',
                variant: 'success',
            });
            // The real-time listener on the jobs page will automatically remove this card
        } catch (error: any) {
            console.error("Error accepting job:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: jobRef.path,
                operation: 'update',
                requestResourceData: { courierId: user.uid, status: 'assigned' }
            }));
            toast({
                variant: 'destructive',
                title: 'Error Accepting Job',
                description: 'This job may have already been taken. Please refresh.',
            });
            setIsLoading(false);
        }
        // No need to set isLoading to false on success, as the component will unmount
    };

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
                <CardTitle>Delivery from {job.addresses.pickup.city} to {job.addresses.delivery.city}</CardTitle>
                <div className="flex items-center gap-2 pt-2">
                    <Badge variant="secondary">{job.distance?.toFixed(1) || 'N/A'} km</Badge>
                    <Badge variant="secondary">{job.timeEstimate || 'N/A'} min</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <span className="font-semibold">From:</span> {job.addresses.pickup.address}, {job.addresses.pickup.city}
                    </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <span className="font-semibold">To:</span> {job.addresses.delivery.address}, {job.addresses.delivery.city}
                    </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Box className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <span className="font-semibold">Package Size:</span> <span className="capitalize">{job.packageSize}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center bg-muted/50 p-4 rounded-b-lg">
                <div className="flex items-center gap-2">
                    <CircleDollarSign className="h-6 w-6 text-green-600" />
                    <span className="text-xl font-bold">{currencyFormatter.format(job.deliveryFee)}</span>
                </div>
                <Button onClick={handleAcceptJob} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Accept Job
                </Button>
            </CardFooter>
        </Card>
    );
}
