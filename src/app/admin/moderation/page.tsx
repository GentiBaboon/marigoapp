'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Shield, MessageSquare, Star, Trash2, ShieldAlert, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, limit } from 'firebase/firestore';
import type { FirestoreReport, FirestoreProduct, FirestoreUser, FirestoreMessage, FirestoreReview } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ModerationQueue } from '@/components/admin/products/moderation-queue';


const ReportItem = ({ report }: { report: FirestoreReport }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isActing, setIsActing] = React.useState(false);

    const itemRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, `${report.type}s`, report.itemId);
    }, [firestore, report.type, report.itemId]);

    const { data: itemData, isLoading } = useDoc<FirestoreProduct | FirestoreUser | FirestoreMessage | FirestoreReview>(itemRef);

    const reporterRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'users', report.reporterId);
    }, [firestore, report.reporterId]);

    const { data: reporter } = useDoc<FirestoreUser>(reporterRef);

    const icons = {
        product: <Shield className="h-4 w-4" />,
        user: <User className="h-4 w-4" />,
        message: <MessageSquare className="h-4 w-4" />,
        review: <Star className="h-4 w-4" />,
    };

    const handleResolve = async (action: 'dismiss' | 'remove') => {
        setIsActing(true);
        try {
            const reportRef = doc(firestore, 'reports', report.id);
            await updateDoc(reportRef, { status: 'resolved' });
            // In a real app, 'remove' would also delete the content and log the action
            toast({ title: `Report resolved`, description: `The report has been marked as resolved.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not resolve the report.' });
        } finally {
            setIsActing(false);
        }
    }
    
    const renderContent = () => {
        if (isLoading) {
            return <Skeleton className="h-20 w-full" />
        }
        if (!itemData) {
            return <p className="text-sm text-muted-foreground">The reported item could not be found.</p>
        }

        switch (report.type) {
            case 'product':
                const product = itemData as FirestoreProduct;
                const productTitle = (typeof product.title === 'object' && product.title?.en) ? product.title.en : product.title;
                return (
                     <div className="flex items-center gap-3">
                        <Image src={product.images?.[0] || ''} alt={productTitle} width={64} height={64} className="rounded-md bg-background" />
                        <div>
                            <p className="font-semibold">{productTitle}</p>
                            <p className="text-sm text-muted-foreground">Item ID: {report.itemId}</p>
                        </div>
                    </div>
                );
            case 'user':
                 const user = itemData as FirestoreUser;
                 return (
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={user.photoURL || undefined} />
                            <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{user.displayName}</p>
                            <p className="text-sm text-muted-foreground">User ID: {report.itemId}</p>
                        </div>
                    </div>
                );
             case 'message':
             case 'review':
                const contentItem = itemData as FirestoreMessage | FirestoreReview;
                const contentText = (typeof contentItem.content === 'object' && contentItem.content?.en) ? contentItem.content.en : contentItem.content;
                return (
                     <blockquote className="border-l-4 pl-4 italic">
                        "{contentText}"
                    </blockquote>
                )
            default:
                return null;
        }
    }


    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            {icons[report.type as keyof typeof icons]}
                             Reported {report.type}
                        </CardTitle>
                        <CardDescription>Reason: {report.reason}</CardDescription>
                    </div>
                    <Badge variant="destructive">{report.status.toUpperCase()}</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="bg-muted/50 p-3 rounded-lg space-y-3">
                   {renderContent()}
                </div>
                 <Separator className="my-4" />
                 <p className="text-sm text-muted-foreground">Reported by: <span className="font-medium text-foreground">{reporter?.displayName || '...'}</span></p>

            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => handleResolve('dismiss')} disabled={isActing}>
                    {isActing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Dismiss
                </Button>
                <Button variant="destructive" onClick={() => handleResolve('remove')} disabled={isActing}>
                    {isActing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Content
                </Button>
            </CardFooter>
        </Card>
    )
}

export default function AdminModerationPage() {
  const firestore = useFirestore();

  const reportsQuery = useMemoFirebase(
    () => query(collection(firestore, 'reports'), where('status', '==', 'pending'), limit(50)),
    [firestore]
  );
  const { data: reports, isLoading: reportsLoading } = useCollection<FirestoreReport>(reportsQuery);

  const productsToReviewQuery = useMemoFirebase(
    () => query(collection(firestore, 'products'), where('status', '==', 'pending_review'), limit(50)),
    [firestore]
  );
  const { data: productsToReview, isLoading: productsLoading } = useCollection<FirestoreProduct>(productsToReviewQuery);


  const reportsByType = (type: string) => reports?.filter(r => r.type === type) || [];

  const isLoading = reportsLoading || productsLoading;
  
  const productCount = (reportsByType('product').length) + (productsToReview?.length || 0);
  const userCount = reportsByType('user').length;
  const messageCount = reportsByType('message').length;
  const reviewCount = reportsByType('review').length;


  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Moderation</h1>
          <p className="text-muted-foreground">
            Review and take action on reported content and new listings.
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="products">
        <TabsList className="grid grid-cols-4 max-w-lg">
            <TabsTrigger value="products">Products ({isLoading ? '...' : productCount})</TabsTrigger>
            <TabsTrigger value="users">Users ({isLoading ? '...' : userCount})</TabsTrigger>
            <TabsTrigger value="messages">Messages ({isLoading ? '...' : messageCount})</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({isLoading ? '...' : reviewCount})</TabsTrigger>
        </TabsList>

        {isLoading ? <p>Loading reports...</p> : (
            <>
                <TabsContent value="products" className="mt-4">
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold mb-4">New Products for Review</h3>
                            {productsToReview && productsToReview.length > 0 ? (
                                <ModerationQueue products={productsToReview} />
                            ) : (
                                <Card>
                                    <CardContent className="p-6 text-center text-muted-foreground">
                                        No new products are waiting for review.
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        <Separator />

                         <div>
                            <h3 className="text-xl font-bold mb-4">Reported Products</h3>
                            {reportsByType('product').length > 0 ? (
                                <div className="space-y-4">
                                  {reportsByType('product').map(report => <ReportItem key={report.id} report={report} />)}
                                </div>
                            ) : (
                                <Card>
                                    <CardContent className="p-6 text-center text-muted-foreground">
                                        No products have been reported.
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="users" className="mt-4">
                    <div className="space-y-4">
                        {reportsByType('user').length > 0 ?
                            reportsByType('user').map(report => <ReportItem key={report.id} report={report} />) :
                            <Card><CardContent className="p-6 text-center text-muted-foreground">No users have been reported.</CardContent></Card>
                        }
                    </div>
                </TabsContent>
                <TabsContent value="messages" className="mt-4">
                    <div className="space-y-4">
                        {reportsByType('message').length > 0 ?
                            reportsByType('message').map(report => <ReportItem key={report.id} report={report} />) :
                            <Card><CardContent className="p-6 text-center text-muted-foreground">No messages have been reported.</CardContent></Card>
                        }
                    </div>
                </TabsContent>
                <TabsContent value="reviews" className="mt-4">
                    <div className="space-y-4">
                        {reportsByType('review').length > 0 ?
                            reportsByType('review').map(report => <ReportItem key={report.id} report={report} />) :
                            <Card><CardContent className="p-6 text-center text-muted-foreground">No reviews have been reported.</CardContent></Card>
                        }
                    </div>
                </TabsContent>
            </>
        )}
      </Tabs>
    </div>
  );
}
