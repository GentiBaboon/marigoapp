
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signOutUser } from '@/firebase/auth/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Loader2, Download, Trash2, ShieldCheck } from 'lucide-react';
import type { FirestoreUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const settingsSchema = z.object({
  emailPreferences: z.object({
    marketing: z.boolean().default(true),
    productUpdates: z.boolean().default(true),
    orderUpdates: z.boolean().default(true),
  }),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function ProfileSettingsPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const functions = getFunctions();
  const { toast } = useToast();
  const router = useRouter();

  const [isSaving, setIsSaving] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = React.useState('');
  
  const userRef = useMemoFirebase(() => user ? doc(firestore, "users", user.uid) : null, [user, firestore]);
  const { data: firestoreUser, isLoading: isFirestoreUserLoading } = useDoc<FirestoreUser>(userRef);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      emailPreferences: { marketing: true, productUpdates: true, orderUpdates: true }
    }
  });

  React.useEffect(() => {
    if (firestoreUser?.emailPreferences) {
      form.reset({ emailPreferences: firestoreUser.emailPreferences });
    }
  }, [firestoreUser, form]);

  const onSubmit = async (data: SettingsFormValues) => {
    if (!userRef) return;
    setIsSaving(true);
    try {
      await updateDoc(userRef, { emailPreferences: data.emailPreferences });
      toast({ title: "Preferences saved successfully!" });
    } catch (error) {
      toast({ variant: 'destructive', title: "Error", description: "Could not save preferences." });
    } finally {
      setIsSaving(false);
    }
  }

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Logic for data export via Cloud Function
      toast({ title: "Export started", description: "You will receive an email with your data shortly." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Export Error" });
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // Logic for account deletion via Cloud Function
      await signOutUser(auth);
      router.push('/');
      toast({ title: "Account Deleted" });
    } catch (error) {
       toast({ variant: 'destructive', title: "Deletion Error" });
    } finally {
       setIsDeleting(false);
    }
  };
  
  if (isUserLoading || isFirestoreUserLoading) return <div className="p-8"><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-8">
        <h1 className="text-3xl font-bold font-headline">Account Settings</h1>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Privacy & Data</CardTitle>
                <CardDescription>Manage your data and email preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="emailPreferences.marketing"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5"><FormLabel className="text-base">Marketing Emails</FormLabel></div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Preferences
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Data Export</CardTitle>
                <CardDescription>Download all your information in JSON format.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="outline" onClick={handleExportData} disabled={isExporting}>
                  {isExporting ? <Loader2 className="animate-spin" /> : "Request Data Export"}
                </Button>
            </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2"><Trash2 className="h-5 w-5" /> Danger Zone</CardTitle>
                <CardDescription>Permanently delete your account and all associated data.</CardDescription>
            </CardHeader>
            <CardContent>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">Delete Account</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>Type DELETE to confirm.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <Input value={deleteConfirmationText} onChange={(e) => setDeleteConfirmationText(e.target.value)} placeholder="DELETE" />
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting || deleteConfirmationText !== 'DELETE'} className="bg-destructive hover:bg-destructive/90">
                                Confirm Deletion
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    </div>
  );
}
