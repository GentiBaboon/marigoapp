'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { FirestoreOrder } from '@/lib/types';
import { useMemo } from 'react';

interface OrdersStatusChartProps {
  orders: FirestoreOrder[];
}

const COLORS = {
  processing: '#3b82f6', // blue-500
  completed: '#22c55e', // green-500
  shipped: '#a855f7', // purple-500
  delivered: '#84cc16', // lime-500
  pending_payment: '#f97316', // orange-500
  payment_failed: '#ef4444', // red-500
  refunded: '#64748b', // slate-500
};

const statusLabels: Record<string, string> = {
    processing: 'Processing',
    completed: 'Completed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    pending_payment: 'Pending Payment',
    payment_failed: 'Payment Failed',
    refunded: 'Refunded',
};

export function OrdersStatusChart({ orders }: OrdersStatusChartProps) {
  const data = useMemo(() => {
    const statusCounts: { [key: string]: number } = {};

    orders.forEach(order => {
      const status = order.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([name, value]) => ({
      name: statusLabels[name] || name,
      value,
      fill: COLORS[name as keyof typeof COLORS] || '#A1A1AA', // a fallback color
    }));
  }, [orders]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders by Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={120}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${value} orders`, 'Count']}
            />
            <Legend iconSize={10} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
