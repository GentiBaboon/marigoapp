'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Monitor, Smartphone, Tablet, UserCheck, UserX, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/admin/stat-card';
import type { PresenceSummary, DeviceClass } from '@/lib/presence';

/** How often the dashboard re-reads. Faster than the 45s heartbeat so a
 *  visitor appears within a few seconds of arriving, but not so fast that an
 *  admin leaving this tab open all day hammers the store. */
const POLL_MS = 15_000;

const DEVICE_ICON: Record<DeviceClass, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

function relative(from: number, now: number): string {
  const secs = Math.max(0, Math.round((now - from) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}

/**
 * Who is on the site right now.
 *
 * Polls rather than streams. A live socket would be tighter, but presence is
 * already only accurate to one heartbeat interval, so a 15s poll costs one
 * cheap request and adds no infrastructure to keep alive.
 */
export function LiveVisitors() {
  const auth = useAuth();
  const [summary, setSummary] = useState<PresenceSummary | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/presence', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        setStale(true);
        return;
      }
      const data = await res.json();
      setConfigured(data.configured !== false);
      setSummary(data.summary ?? null);
      setStale(false);
      setNow(Date.now());
    } catch {
      // Keep showing the last good reading rather than blanking the panel —
      // one dropped poll is not the same as nobody being on the site.
      setStale(true);
    }
  }, [auth]);

  useEffect(() => {
    void load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (configured === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live visitors</CardTitle>
          <CardDescription>Not configured</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Set <code className="text-xs">UPSTASH_REDIS_REST_URL</code> and{' '}
            <code className="text-xs">UPSTASH_REDIS_REST_TOKEN</code> to switch this on. Everything
            else on this page works without them.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (configured === null && !summary) {
    return <Skeleton className="h-[420px] w-full rounded-lg" />;
  }

  const s = summary;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Online now"
          value={s?.online ?? 0}
          icon={
            stale ? (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Wifi className="h-4 w-4 text-emerald-500" />
            )
          }
          description={stale ? 'Reconnecting — showing last reading' : 'Active in the last 90 seconds'}
        />
        <StatCard
          title="Signed in"
          value={s?.signedIn ?? 0}
          icon={<UserCheck className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Browsing signed out"
          value={s?.anonymous ?? 0}
          icon={<UserX className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Pages in use"
          value={s?.byPath.length ?? 0}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Where they are</CardTitle>
            <CardDescription>Busiest pages right now</CardDescription>
          </CardHeader>
          <CardContent>
            {!s?.byPath.length ? (
              <p className="text-sm text-muted-foreground">Nobody on the site right now.</p>
            ) : (
              <ul className="space-y-2">
                {s.byPath.slice(0, 10).map(({ path, count }) => (
                  <li key={path} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-mono text-xs">{path}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {/* Bar width is relative to the busiest page, so the
                          shape stays readable whether 3 people are on the site
                          or 300. */}
                      <span
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${Math.max(8, (count / s.byPath[0].count) * 80)}px` }}
                      />
                      <span className="tabular-nums text-muted-foreground w-6 text-right">{count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active sessions</CardTitle>
            <CardDescription>Longest-running first</CardDescription>
          </CardHeader>
          <CardContent>
            {!s?.sessions.length ? (
              <p className="text-sm text-muted-foreground">No active sessions.</p>
            ) : (
              <ul className="space-y-2 max-h-[260px] overflow-y-auto">
                {s.sessions.slice(0, 25).map((session) => {
                  const Icon = DEVICE_ICON[session.device] ?? Monitor;
                  return (
                    <li key={session.sessionId} className="flex items-center gap-3 text-sm">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {session.name ?? (
                          <span className="text-muted-foreground">Signed-out visitor</span>
                        )}
                      </span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {session.path}
                      </span>
                      <Badge variant="secondary" className="ml-auto shrink-0 tabular-nums">
                        {relative(session.startedAt, now)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
