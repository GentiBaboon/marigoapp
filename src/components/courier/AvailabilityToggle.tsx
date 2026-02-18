'use client';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { FirestoreCourierProfile } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export function AvailabilityToggle() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const profileRef = useMemoFirebase(
        () => user ? doc(firestore, 'courier_profiles', user.uid) : null,
        [user, firestore]
    );

    const { data: profile, isLoading: isProfileLoading } = useDoc<FirestoreCourierProfile>(profileRef);

    const [isAvailable, setIsAvailable] = useState(profile?.isAvailable ?? true);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (profile) {
            setIsAvailable(profile.isAvailable);
        }
    }, [profile]);

    const handleToggle = async (checked: boolean) => {
        if (!profileRef) return;
        setIsUpdating(true);
        setIsAvailable(checked);
        try {
            await updateDoc(profileRef, { isAvailable: checked });
            toast({
                title: 'Status Updated',
                description: `You are now ${checked ? 'available' : 'unavailable'} for deliveries.`,
            });
        } catch (error) {
            console.error("Failed to update availability:", error);
            // Revert state on error
            setIsAvailable(!checked);
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: 'Could not update your availability status.',
            });
        } finally {
            setIsUpdating(false);
        }
    };
    
    if (isProfileLoading) {
        return <div className="flex items-center justify-center h-10 w-40 bg-muted rounded-lg"><Loader2 className="h-5 w-5 animate-spin"/></div>
    }

    return (
        <div className="flex items-center space-x-2 rounded-lg bg-background p-3 border">
            <Switch
                id="availability-mode"
                checked={isAvailable}
                onCheckedChange={handleToggle}
                disabled={isUpdating}
            />
            <Label htmlFor="availability-mode" className="font-semibold text-lg">
                {isAvailable ? 'Available' : 'Unavailable'}
            </Label>
        </div>
    );
}
