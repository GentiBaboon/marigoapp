import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ModerationLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
      </div>
      
      <Tabs defaultValue="products">
        <TabsList className="grid grid-cols-4 max-w-lg">
          <TabsTrigger value="products"><Skeleton className="h-4 w-20" /></TabsTrigger>
          <TabsTrigger value="users"><Skeleton className="h-4 w-16" /></TabsTrigger>
          <TabsTrigger value="messages"><Skeleton className="h-4 w-24" /></TabsTrigger>
          <TabsTrigger value="reviews"><Skeleton className="h-4 w-20" /></TabsTrigger>
        </TabsList>
        <Card className="mt-4">
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-48 mt-2" />
                </div>
                <Skeleton className="h-6 w-20" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-16 w-16 rounded-md" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
          </CardFooter>
        </Card>
      </Tabs>
    </div>
  );
}
