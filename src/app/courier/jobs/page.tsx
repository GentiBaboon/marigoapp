'use client';
import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { FirestoreDelivery } from '@/lib/types';
import { JobCard } from '@/components/courier/JobCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ListFilter } from 'lucide-react';

function JobsLoading() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
        </div>
    )
}

function EmptyState() {
    return (
        <div className="text-center py-20 px-4 flex flex-col items-center justify-center h-full border-2 border-dashed rounded-lg">
            <Briefcase className="mx-auto h-16 w-16 text-muted-foreground" />
            <h2 className="mt-6 text-xl font-semibold">No Available Jobs</h2>
            <p className="mt-2 text-muted-foreground">
                Check back later for new delivery opportunities. Make sure you are set to "Available".
            </p>
        </div>
    );
}

export default function CourierJobsPage() {
    const firestore = useFirestore();
    const [sortOption, setSortOption] = React.useState('newest');

    const jobsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'deliveries'),
            where('status', '==', 'pending_assignment')
        );
    }, [firestore]);

    const { data: jobs, isLoading } = useCollection<FirestoreDelivery>(jobsQuery);
    
    const sortedJobs = React.useMemo(() => {
        if (!jobs) return [];
        const sorted = [...jobs];
        switch (sortOption) {
            case 'newest':
                return sorted.sort((a, b) => {
                    const aTime = a.createdAt?.seconds || 0;
                    const bTime = b.createdAt?.seconds || 0;
                    return bTime - aTime;
                });
            case 'highest_fee':
                return sorted.sort((a, b) => (b.deliveryFee || 0) - (a.deliveryFee || 0));
            case 'nearest':
                // Distance sorting requires geolocation; fall back to newest
                return sorted;
            default:
                return sorted;
        }
    }, [jobs, sortOption]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Jobs Board</h1>
                    <p className="text-muted-foreground">Find available delivery jobs in your area.</p>
                </div>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                            <ListFilter className="mr-2 h-4 w-4" />
                            Sort By
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuRadioGroup value={sortOption} onValueChange={setSortOption}>
                            <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="highest_fee">Highest Fee</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="nearest">Nearest</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            
            {isLoading ? (
                <JobsLoading />
            ) : sortedJobs && sortedJobs.length > 0 ? (
                <div className="space-y-4">
                    {sortedJobs.map(job => <JobCard key={job.id} job={job} />)}
                </div>
            ) : (
                <EmptyState />
            )}
        </div>
    );
}
