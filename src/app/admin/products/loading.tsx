import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProductsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
      </div>
      
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">
            <Skeleton className="h-4 w-24" />
          </TabsTrigger>
          <TabsTrigger value="all">
            <Skeleton className="h-4 w-28" />
          </TabsTrigger>
        </TabsList>
        <Card className="mt-4">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
              </div>
              <Skeleton className="h-[400px] w-full" />
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-20" />
                    <Skeleton className="h-10 w-20" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
