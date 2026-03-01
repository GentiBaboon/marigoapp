
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useAuth, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { editProfileSchema, type EditProfileValues, type FirestoreUser } from '@/lib/types';
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
  
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: firestoreUser } = useDoc<FirestoreUser>(userDocRef);

  const form = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
    },
  });
  
  useEffect(() => {
    if (firestoreUser) {
        const nameParts = firestoreUser.name?.split(' ') || [firestoreUser.name || ''];
        form.reset({
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            phone: firestoreUser.phone || '',
        })
    } else if (user) {
        const nameParts = user.displayName?.split(' ') || [user.displayName || ''];
        form.reset({
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            phone: '',
        });
    }
  }, [firestoreUser, user, form]);

  async function onSubmit(data: EditProfileValues) {
    if (!user || !auth.currentUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to update your profile.' });
        return;
    }
    setLoading(true);

    const fullUserName = `${data.firstName} ${data.lastName}`.trim();

    try {
        // Update Firebase Auth profile
        await updateProfile(auth.currentUser, { displayName: fullUserName });
        
        // Update Firestore user document
        const userDocRef = doc(firestore, 'users', user.uid);
        await setDoc(userDocRef, { 
            name: fullUserName,
            phone: data.phone,
         }, { merge: true });

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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Surname</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                        <Input placeholder="+1 234 567 890" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormItem>
            <FormLabel>E-mail</FormLabel>
            <FormControl>
                <Input readOnly disabled value={user?.email || ''} />
            </FormControl>
            <FormMessage />
        </FormItem>
        <Button type="submit" disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}
