import { Skeleton } from '@/components/ui/skeleton';

export default function DisputesLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-[200px] w-full" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}
