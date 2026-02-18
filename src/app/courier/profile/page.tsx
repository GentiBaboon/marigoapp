'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import type { FirestoreUser, FirestoreReview, FirestoreCourierProfile } from '@/lib/types';
import { StatCard } from '@/components/admin/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, CheckCircle, Percent, XCircle, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { signOutUser } from '@/firebase/auth/actions';
import { useToast } from '@/hooks/use-toast';

const getInitials = (name?: string | null) => {
  if (!name) return 'U';
  const names = name.split(' ');
  return names.length > 1
    ? `${names[0][0]}${names[names.length - 1][0]}`
    : name.substring(0, 2);
};

function ReviewItem({ review }: { review: FirestoreReview }) {
  const firestore = useFirestore();
  const reviewerRef = useMemoFirebase(() => doc(firestore, 'users', review.reviewerId), [firestore, review.reviewerId]);
  const { data: reviewer } = useDoc<FirestoreUser>(reviewerRef);

  return (
    <div className="flex items-start gap-4 py-4">
        <Avatar>
            <AvatarImage src={reviewer?.photoURL || undefined} />
            <AvatarFallback>{getInitials(reviewer?.displayName)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <p className="font-semibold">{reviewer?.displayName || 'Anonymous'}</p>
                <p className="text-xs text-muted-foreground">{format(review.createdAt.toDate(), 'MMM d, yyyy')}</p>
            </div>
            <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                ))}
            </div>
            <p className="text-sm text-muted-foreground">{review.content}</p>
        </div>
    </div>
  );
}


export default function CourierProfilePage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    // Mock data for stats
    const profileStats = {
        deliveries: 128,
        onTime: 98,
        avgRating: 4.9,
        cancellationRate: 2,
    };

    const reviewsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'reviews'),
            where('revieweeId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
    }, [user, firestore]);
    
    const { data: reviews, isLoading } = useCollection<FirestoreReview>(reviewsQuery);
    
    const handleSignOut = async () => {
        await signOutUser(auth);
        toast({ title: "Signed Out" });
        router.push('/');
    };

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader className="flex-row items-center gap-4">
                    <Avatar className="h-16 w-16 text-2xl">
                        <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || ''} />
                        <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold">{user?.displayName}</h1>
                        <p className="text-muted-foreground">Courier since {format(new Date(), 'MMMM yyyy')}</p>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Deliveries" value={profileStats.deliveries} icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="Avg. Rating" value={`${profileStats.avgRating}/5`} icon={<Star className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="On-time" value={`${profileStats.onTime}%`} icon={<Percent className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="Cancellations" value={`${profileStats.cancellationRate}%`} icon={<XCircle className="h-4 w-4 text-muted-foreground" />} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Reviews</CardTitle>
                    <CardDescription>What people are saying about you.</CardDescription>
                </CardHeader>
                <CardContent>
                     {isLoading ? (
                         <div className="space-y-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : reviews && reviews.length > 0 ? (
                        <div className="divide-y">
                            {reviews.map(r => <ReviewItem key={r.id} review={r} />)}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No reviews yet.</p>
                    )}
                </CardContent>
            </Card>
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
            </Button>
        </div>
    );
}
