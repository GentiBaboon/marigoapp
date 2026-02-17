'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { FirestoreOrder } from '@/lib/types';
import { useMemo } from 'react';
import { format, subMonths } from 'date-fns';

interface RevenueChartProps {
  orders: FirestoreOrder[];
}

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function RevenueChart({ orders }: RevenueChartProps) {
  const data = useMemo(() => {
    const monthlyRevenue: { [key: string]: number } = {};
    
    // Initialize last 12 months to ensure they all appear
    for (let i = 11; i >= 0; i--) {
        const month = format(subMonths(new Date(), i), 'MMM yyyy');
        monthlyRevenue[month] = 0;
    }

    orders.forEach(order => {
        // Ensure createdAt exists and has a toDate method
        if (order.createdAt?.toDate) {
            const orderDate = order.createdAt.toDate();
            const month = format(orderDate, 'MMM yyyy');
            if (monthlyRevenue.hasOwnProperty(month)) {
               monthlyRevenue[month] += order.totalAmount;
            }
        }
    });

    return Object.entries(monthlyRevenue)
        .map(([name, revenue]) => ({ name, revenue }));
  }, [orders]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Revenue (Last 12 Months)</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => currencyFormatter.format(value as number)}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}
              labelStyle={{ color: "#0f172a" }}
              formatter={(value) => [currencyFormatter.format(value as number), 'Revenue']}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 4, fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 8, stroke: 'hsl(var(--primary))', fill: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
