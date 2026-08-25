'use client';

import { useMemo, useState } from 'react';
import { format, subDays, eachDayOfInterval, startOfDay, isSameDay } from 'date-fns';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PeriodSelector, type Period } from '@/components/admin/charts/period-selector';
import { toDate, type FirestoreUser } from '@/lib/types';
import { exportToCSV } from '@/lib/csv-export';
import { Download } from 'lucide-react';

const DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

interface Props {
  users: FirestoreUser[];
  isLoading?: boolean;
}

/**
 * Registration history by date.
 *
 * Two views of the same range, because they answer different questions: the
 * bars say how many joined on a given day, the area says how big the base has
 * become. A single cumulative line hides a dead week; a single daily bar hides
 * that the dead week barely dented total growth.
 *
 * All bucketing is client-side over the users the dashboard has already
 * loaded, so this adds no reads to a page that pays for the collection anyway.
 */
export function UserHistory({ users, isLoading }: Props) {
  const [period, setPeriod] = useState<Period>('30d');

  const { daily, totalInRange, busiest, recent } = useMemo(() => {
    const days = DAYS[period];
    const today = startOfDay(new Date());
    const from = subDays(today, days - 1);

    // Seeded with every day in the range, so a day nobody joined plots as a
    // zero rather than vanishing and stretching the one beside it.
    const buckets = new Map<string, { date: Date; signups: number }>();
    for (const day of eachDayOfInterval({ start: from, end: today })) {
      buckets.set(format(day, 'yyyy-MM-dd'), { date: day, signups: 0 });
    }

    const inRange: Array<{ user: FirestoreUser; joined: Date }> = [];
    for (const user of users ?? []) {
      const joined = toDate(user.createdAt);
      if (!joined || joined < from) continue;
      const bucket = buckets.get(format(joined, 'yyyy-MM-dd'));
      if (bucket) bucket.signups++;
      inRange.push({ user, joined });
    }

    // Everyone who already existed before the window opens — the baseline the
    // cumulative line grows from, or it would look like the site started today.
    let running = (users ?? []).filter((u) => {
      const d = toDate(u.createdAt);
      return d && d < from;
    }).length;

    const daily = [...buckets.values()].map(({ date, signups }) => {
      running += signups;
      return {
        key: format(date, 'yyyy-MM-dd'),
        label: format(date, days > 90 ? 'MMM' : 'MMM d'),
        signups,
        total: running,
      };
    });

    const busiest = daily.reduce((a, b) => (b.signups > a.signups ? b : a), daily[0]);

    return {
      daily,
      totalInRange: inRange.length,
      busiest,
      recent: inRange.sort((a, b) => b.joined.getTime() - a.joined.getTime()).slice(0, 40),
    };
  }, [users, period]);

  const exportCsv = () => {
    exportToCSV(
      daily,
      [
        { key: 'key', header: 'Date' },
        { key: 'signups', header: 'New users' },
        { key: 'total', header: 'Total users' },
      ],
      `marigo-signups-${period}-${format(new Date(), 'yyyy-MM-dd')}`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-headline text-xl">Registrations by date</h2>
          <p className="text-sm text-muted-foreground">
            {totalInRange} joined in this period
            {busiest?.signups ? ` · busiest day ${busiest.label} (${busiest.signups})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading}>
            <Download className="mr-2 h-3.5 w-3.5" />
            CSV
          </Button>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New users per day</CardTitle>
            <CardDescription>How many joined each day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelFormatter={(l) => `Joined ${l}`}
                />
                <Bar dataKey="signups" name="New users" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total users over time</CardTitle>
            <CardDescription>Cumulative, including everyone who joined earlier</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="totalUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total users"
                  stroke="hsl(var(--primary))"
                  fill="url(#totalUsers)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Who joined, most recent first</CardTitle>
          <CardDescription>Newest {recent.length} in this period</CardDescription>
        </CardHeader>
        <CardContent>
          {!recent.length ? (
            <p className="text-sm text-muted-foreground">Nobody joined in this period.</p>
          ) : (
            <ul className="divide-y max-h-[380px] overflow-y-auto">
              {recent.map(({ user, joined }, i) => (
                <li key={(user as any).id ?? `${user.email}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="truncate font-medium">
                    {user.displayName || (user as any).name || (
                      <span className="text-muted-foreground font-normal">Unnamed</span>
                    )}
                  </span>
                  <span className="truncate text-muted-foreground text-xs">{user.email}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    {user.role && user.role !== 'buyer' && (
                      <Badge variant="secondary" className="text-[10px]">{user.role}</Badge>
                    )}
                    {user.emailVerified === false && (
                      <Badge variant="outline" className="text-[10px]">unverified</Badge>
                    )}
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {isSameDay(joined, new Date())
                        ? format(joined, 'HH:mm')
                        : format(joined, 'd MMM yyyy')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
