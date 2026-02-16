'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { editProfileSchema, type EditProfileValues } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface EditProfileFormProps {
  onSuccess: () => void;
}

export function EditProfileForm({ onSuccess }: EditProfileFormProps) {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      displayName: user?.displayName || '',
    },
  });

  async function onSubmit(data: EditProfileValues) {
    if (!user || !auth.currentUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to update your profile.' });
        return;
    }
    setLoading(true);

    try {
        // Update Firebase Auth profile
        await updateProfile(auth.currentUser, { displayName: data.displayName });
        
        // Update Firestore user document
        const userDocRef = doc(firestore, 'users', user.uid);
        await setDoc(userDocRef, { displayName: data.displayName }, { merge: true });

        toast({ title: 'Profile Updated', description: 'Your profile has been successfully updated.' });
        onSuccess();
    } catch (error: any) {
        console.error("Error updating profile:", error);
        toast({
            variant: 'destructive',
            title: 'Update failed',
            description: error.message || 'Could not update your profile.',
        });
    } finally {
        setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Your full name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}
