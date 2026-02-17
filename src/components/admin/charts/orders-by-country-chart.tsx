'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { FirestoreOrder } from '@/lib/types';
import { useMemo } from 'react';

interface OrdersByCountryChartProps {
  orders: FirestoreOrder[];
}

export function OrdersByCountryChart({ orders }: OrdersByCountryChartProps) {
  const data = useMemo(() => {
    const countryCounts: { [key: string]: number } = {};

    orders.forEach(order => {
        if (order.shippingAddress?.country) {
            const country = order.shippingAddress.country;
            countryCounts[country] = (countryCounts[country] || 0) + 1;
        }
    });

    return Object.entries(countryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geographic Distribution (by Order)</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#888888" fontSize={12} />
            <YAxis stroke="#888888" fontSize={12} allowDecimals={false}/>
            <Tooltip formatter={(value) => [value, 'Order Count']} />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
