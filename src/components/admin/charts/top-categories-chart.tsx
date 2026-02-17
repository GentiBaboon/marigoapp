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
import type { FirestoreProduct } from '@/lib/types';
import { useMemo } from 'react';

interface TopCategoriesChartProps {
  products: FirestoreProduct[];
}

export function TopCategoriesChart({ products }: TopCategoriesChartProps) {
  const data = useMemo(() => {
    const categoryCounts: { [key: string]: number } = {};

    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    return Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Get top 10
  }, [products]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Product Categories</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis
              dataKey="name"
              type="category"
              width={80}
              tick={{ fontSize: 12 }}
              interval={0}
            />
            <Tooltip formatter={(value) => [value, 'Product Count']} />
            <Bar dataKey="count" fill="hsl(var(--primary))" barSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
