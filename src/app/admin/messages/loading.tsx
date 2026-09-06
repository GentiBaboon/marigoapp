import { Skeleton } from '@/components/ui/skeleton';

export default function AdminMessagesLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[128px] w-full" />
        ))}
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-[520px] w-80 shrink-0" />
        <Skeleton className="h-[520px] flex-1" />
      </div>
    </div>
  );
}
