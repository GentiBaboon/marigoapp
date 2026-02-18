'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/admin/stat-card';
import { AvailabilityToggle } from '@/components/courier/AvailabilityToggle';
import { Truck, CircleDollarSign, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CourierDashboardPage() {
    // These would come from state or props in a real app
    const todayStats = {
        deliveries: 3,
        earnings: 25.50
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Courier Dashboard</h1>
                    <p className="text-muted-foreground">Manage your availability and track your deliveries.</p>
                </div>
                <AvailabilityToggle />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Today's Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <StatCard
                        title="Deliveries Completed"
                        value={todayStats.deliveries}
                        icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
                    />
                    <StatCard
                        title="Earnings Today"
                        value={`€${todayStats.earnings.toFixed(2)}`}
                        icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Active Delivery
                    </CardTitle>
                    <CardDescription>
                        You do not have an active delivery. Available jobs will appear on the jobs board.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button>Go to Jobs Board</Button>
                </CardContent>
            </Card>
        </div>
    );
}
