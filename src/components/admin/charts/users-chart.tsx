'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { FirestoreUser } from '@/lib/types';
import { useMemo } from 'react';
import { format, subDays, eachDayOfInterval } from 'date-fns';

interface UsersChartProps {
  users: FirestoreUser[];
}

export function UsersChart({ users }: UsersChartProps) {
  const data = useMemo(() => {
    const dailySignups: { [key: string]: number } = {};
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 29);
    
    const interval = eachDayOfInterval({ start: thirtyDaysAgo, end: today });
    interval.forEach(day => {
        const dateKey = format(day, 'MMM d');
        dailySignups[dateKey] = 0;
    });

    users.forEach(user => {
      if (user.createdAt?.toDate) {
        const signupDate = user.createdAt.toDate();
        if (signupDate >= thirtyDaysAgo) {
          const dateKey = format(signupDate, 'MMM d');
          if (dailySignups[dateKey] !== undefined) {
             dailySignups[dateKey]++;
          }
        }
      }
    });

    return Object.entries(dailySignups).map(([name, count]) => ({ name, users: count }));
  }, [users]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Users (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data}>
            <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
            </defs>
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
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}
              labelStyle={{ color: "#0f172a" }}
            />
            <Area
              type="monotone"
              dataKey="users"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorUsers)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
