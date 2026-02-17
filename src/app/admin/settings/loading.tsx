import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';

export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-48 mt-2" />
                    </div>
                    <Skeleton className="h-9 w-32" />
                </div>
            </CardHeader>
            <CardContent>
                <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-40 mt-2" />
                    </div>
                    <Skeleton className="h-9 w-28" />
                </div>
            </CardHeader>
            <CardContent>
                <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-16 w-full" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-full" />
                </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  );
}
