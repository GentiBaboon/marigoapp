'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrency } from '@/context/CurrencyContext';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { type FirestoreOrder, toDate } from '@/lib/types';
import { useMemo } from 'react';
import { format, subMonths } from 'date-fns';

interface RevenueChartProps {
  orders: FirestoreOrder[];
}

export function RevenueChart({ orders }: RevenueChartProps) {
  // Axis labels compact once the *converted* figure gets long. The threshold
  // has to be on what is displayed, not on the stored EUR: at 93 lek to the
  // euro a €400 month is "37.200 ALL", and five of those stacked down a Y axis
  // squeeze the plot off the card. The tooltip always shows the full figure.
  const { formatPrice, rate } = useCurrency();
  const axisLabel = (value: number) => {
    const shown = value * rate;
    if (Math.abs(shown) >= 10000) return `${Math.round(shown / 1000)}k`;
    return formatPrice(value);
  };
  const data = useMemo(() => {
    const monthlyRevenue: { [key: string]: number } = {};
    
    // Initialize last 12 months to ensure they all appear
    for (let i = 11; i >= 0; i--) {
        const month = format(subMonths(new Date(), i), 'MMM yyyy');
        monthlyRevenue[month] = 0;
    }

    orders.forEach(order => {
        const orderDate = toDate(order.createdAt);
        if (orderDate) {
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
              tickFormatter={(value) => axisLabel(value as number)}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}
              labelStyle={{ color: "#0f172a" }}
              formatter={(value) => [formatPrice(value as number), 'Revenue']}
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
