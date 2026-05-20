'use client';

import * as React from 'react';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { useDoc, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import {
  DEFAULT_BADGE_SETTINGS,
  type BadgeSettings,
  type SellerBadgeLevel,
} from '@/lib/types';

interface BadgeConfigTabProps {
  firestore: Firestore;
  toast: (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}

const LEVELS: SellerBadgeLevel[] = ['trusted', 'expert', 'activist', 'official'];

export function BadgeConfigTab({ firestore, toast }: BadgeConfigTabProps) {
  const ref = useMemoFirebase(() => doc(firestore, 'settings', 'badges'), [firestore]);
  const { data: stored, isLoading } = useDoc<BadgeSettings>(ref);

  const [labels, setLabels] = React.useState<BadgeSettings['labels']>(DEFAULT_BADGE_SETTINGS.labels);
  const [variantsEnabled, setVariantsEnabled] = React.useState<BadgeSettings['variantsEnabled']>(DEFAULT_BADGE_SETTINGS.variantsEnabled);
  const [trustedMin, setTrustedMin] = React.useState(String(DEFAULT_BADGE_SETTINGS.trustedMinSales));
  const [expertMin, setExpertMin] = React.useState(String(DEFAULT_BADGE_SETTINGS.expertMinSales));
  const [activistMin, setActivistMin] = React.useState(String(DEFAULT_BADGE_SETTINGS.activistMinSales));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (stored) {
      setLabels({ ...DEFAULT_BADGE_SETTINGS.labels, ...(stored.labels ?? {}) });
      setVariantsEnabled({ ...DEFAULT_BADGE_SETTINGS.variantsEnabled, ...(stored.variantsEnabled ?? {}) });
      setTrustedMin(String(stored.trustedMinSales ?? DEFAULT_BADGE_SETTINGS.trustedMinSales));
      setExpertMin(String(stored.expertMinSales ?? DEFAULT_BADGE_SETTINGS.expertMinSales));
      setActivistMin(String(stored.activistMinSales ?? DEFAULT_BADGE_SETTINGS.activistMinSales));
    }
  }, [stored]);

  const handleSave = async () => {
    // Clamp thresholds so they stay monotonically non-decreasing
    // (trusted ≤ expert ≤ activist). Prevents UI states where Activist requires
    // fewer sales than Expert.
    const parsedTrusted = Math.max(0, Math.floor(Number(trustedMin) || 0));
    const parsedExpert = Math.max(parsedTrusted, Math.floor(Number(expertMin) || 0));
    const parsedActivist = Math.max(parsedExpert, Math.floor(Number(activistMin) || 0));
    setSaving(true);
    try {
      const payload: BadgeSettings = {
        trustedMinSales: parsedTrusted,
        expertMinSales: parsedExpert,
        activistMinSales: parsedActivist,
        labels,
        variantsEnabled,
      };
      await setDoc(ref, payload, { merge: true });
      toast({ title: 'Badges updated', description: 'Changes apply to the marketplace immediately.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: e?.message || 'Could not save badge settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const trustedNum = Number(trustedMin) || 0;
  const expertNum = Number(expertMin) || 0;
  const activistNum = Number(activistMin) || 0;
  const thresholdInvalid = expertNum < trustedNum || activistNum < expertNum;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seller Badges</CardTitle>
        <CardDescription>
          Rename each badge and set the sales thresholds. Changes take effect across the marketplace as soon as you save —
          no redeploy needed. <em>Official Registered Brand</em> is part of the badge ladder; admins can also assign any badge
          manually from the Users page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Labels</h3>
          {LEVELS.map((level) => (
            <div key={level} className="grid grid-cols-[120px_1fr] items-center gap-3">
              <Label className="capitalize">{level}</Label>
              <Input
                value={labels[level]}
                onChange={(e) => setLabels((prev) => ({ ...prev, [level]: e.target.value }))}
                placeholder={DEFAULT_BADGE_SETTINGS.labels[level]}
              />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Thresholds (completed sales)</h3>
          <p className="text-xs text-muted-foreground">
            Each tier is a sales range. Editing a tier&apos;s <em>max</em> automatically shifts the next tier&apos;s <em>min</em> to <code>max + 1</code> so there&apos;s no gap or overlap.
          </p>

          {/* Trusted row */}
          <div className="grid grid-cols-[120px_1fr_1fr] items-center gap-3">
            <Label>{labels.trusted}</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">min</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={trustedMin}
                onChange={(e) => setTrustedMin(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">max</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={Math.max(0, (Number(expertMin) || 0) - 1)}
                onChange={(e) => {
                  // Trusted's max = Expert's min - 1, so shift expertMin.
                  const next = Math.max(0, Math.floor(Number(e.target.value) || 0)) + 1;
                  setExpertMin(String(next));
                }}
                className="w-24"
              />
            </div>
          </div>

          {/* Expert row */}
          <div className="grid grid-cols-[120px_1fr_1fr] items-center gap-3">
            <Label>{labels.expert}</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">min</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={expertMin}
                onChange={(e) => setExpertMin(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">max</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={Math.max(0, (Number(activistMin) || 0) - 1)}
                onChange={(e) => {
                  const next = Math.max(0, Math.floor(Number(e.target.value) || 0)) + 1;
                  setActivistMin(String(next));
                }}
                className="w-24"
              />
            </div>
          </div>

          {/* Activist row — unbounded max */}
          <div className="grid grid-cols-[120px_1fr_1fr] items-center gap-3">
            <Label>{labels.activist}</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">min</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={activistMin}
                onChange={(e) => setActivistMin(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">max</span>
              <Input value="∞" disabled className="w-24 text-center" />
            </div>
          </div>

          {thresholdInvalid && (
            <p className="text-xs text-destructive">
              Ranges overlap. They will be clamped on save (Trusted ≤ Expert ≤ Activist).
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Sellers below the Trusted min get no visible badge. The Official badge is set per-user from the Users page
            and overrides threshold-based levels.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Per-tier features</h3>
          <p className="text-xs text-muted-foreground">
            Variants on/off controls whether sellers at that tier can list products with per-size inventory (multi-variant listings).
          </p>
          {LEVELS.map((level) => (
            <div key={level} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{labels[level]}</p>
                <p className="text-xs text-muted-foreground capitalize">{level}</p>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Variants</Label>
                <Switch
                  checked={!!variantsEnabled[level]}
                  onCheckedChange={(checked) => setVariantsEnabled((prev) => ({ ...prev, [level]: checked }))}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
