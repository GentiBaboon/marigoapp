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
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signOutUser } from '@/firebase/auth/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
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

function SettingsPageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <Skeleton className="h-10 w-48" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-24" />
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-48" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40 text-destructive" />
        </CardHeader>
        <CardContent>
           <Skeleton className="h-10 w-48" />
        </CardContent>
      </Card>
    </div>
  );
}


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
      emailPreferences: {
        marketing: true,
        productUpdates: true,
        orderUpdates: true,
      }
    }
  });

  React.useEffect(() => {
    if (firestoreUser?.emailPreferences) {
      form.reset({
        emailPreferences: firestoreUser.emailPreferences,
      });
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
      const exportUserData = httpsCallable(functions, 'exportUserData');
      const result: any = await exportUserData();
      
      // Trigger download
      const link = document.createElement('a');
      link.href = result.data.downloadUrl;
      link.setAttribute('download', `marigo-data-export-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Data export started", description: "Your download will begin shortly." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Export Error", description: "Could not export your data." });
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const deleteAccountFunc = httpsCallable(functions, 'deleteAccount');
      await deleteAccountFunc();
      toast({ title: "Account Deletion Successful", description: "Your account is being deleted." });
      await signOutUser(auth);
      router.push('/');
    } catch (error) {
       toast({ variant: 'destructive', title: "Deletion Error", description: "Could not delete your account." });
    } finally {
       setIsDeleting(false);
    }
  };
  
  const isLoading = isUserLoading || isFirestoreUserLoading;

  if (isLoading) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Manage how you receive emails from us.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="emailPreferences.marketing"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Marketing & Promotions</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="emailPreferences.productUpdates"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Product Updates & News</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="emailPreferences.orderUpdates"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Order & Shipping Updates</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
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
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Export your personal data stored on MarigoApp.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="outline" onClick={handleExportData} disabled={isExporting}>
                  {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Export My Data
                </Button>
            </CardContent>
        </Card>

        <Card className="border-destructive">
            <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>These actions are irreversible. Please proceed with caution.</CardDescription>
            </CardHeader>
            <CardContent>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">Delete My Account</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your account, listings, and all associated data. To confirm, please type <strong>DELETE</strong> in the box below.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Input 
                          value={deleteConfirmationText}
                          onChange={(e) => setDeleteConfirmationText(e.target.value)}
                          placeholder="DELETE"
                        />
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteAccount}
                                disabled={isDeleting || deleteConfirmationText !== 'DELETE'}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Yes, delete my account
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
