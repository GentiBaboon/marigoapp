'use client';

import * as React from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_RELATED_PRODUCTS_CONFIG,
  type FirestoreSettings,
  type RelatedProductsConfig,
} from '@/lib/types';

export function RelatedProductsTab() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const settingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'global') : null),
    [firestore],
  );
  const { data: settings, isLoading } = useDoc<FirestoreSettings>(settingsRef);

  const [form, setForm] = React.useState<RelatedProductsConfig>(DEFAULT_RELATED_PRODUCTS_CONFIG);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (settings?.relatedProducts) {
      setForm({ ...DEFAULT_RELATED_PRODUCTS_CONFIG, ...settings.relatedProducts });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!firestore) return;
    setSaving(true);
    try {
      await setDoc(
        doc(firestore, 'settings', 'global'),
        { relatedProducts: form },
        { merge: true },
      );
      toast({ title: 'Related products settings saved.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not save settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Related Products</CardTitle>
        <CardDescription>
          Control the rail shown at the bottom of every product detail page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable related products</Label>
            <p className="text-xs text-muted-foreground">
              Hide the section entirely when off.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm({ ...form, enabled: v })}
          />
        </div>

        <div className="space-y-2">
          <Label>Number of products to show</Label>
          <Input
            type="number"
            min={2}
            max={20}
            value={form.count}
            onChange={(e) =>
              setForm({
                ...form,
                count: Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 0)),
              })
            }
          />
          <p className="text-xs text-muted-foreground">Between 2 and 20.</p>
        </div>

        <div className="space-y-2">
          <Label>Match by</Label>
          <Select
            value={form.matchBy}
            onValueChange={(v) => setForm({ ...form, matchBy: v as RelatedProductsConfig['matchBy'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="subcategory">Same subcategory</SelectItem>
              <SelectItem value="brand">Same brand</SelectItem>
              <SelectItem value="gender">Same gender</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Primary similarity rule. We always require status = active and exclude the current item.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Also require same gender</Label>
            <p className="text-xs text-muted-foreground">
              Useful when matching by subcategory or brand to avoid mixing menswear and womenswear.
            </p>
          </div>
          <Switch
            checked={form.sameGender}
            onCheckedChange={(v) => setForm({ ...form, sameGender: v })}
            disabled={form.matchBy === 'gender'}
          />
        </div>

        <div className="space-y-2">
          <Label>Sort by</Label>
          <Select
            value={form.sortBy}
            onValueChange={(v) =>
              setForm({ ...form, sortBy: v as RelatedProductsConfig['sortBy'] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="priceAsc">Price: low to high</SelectItem>
              <SelectItem value="priceDesc">Price: high to low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={saving || isLoading}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save settings
        </Button>
      </CardFooter>
    </Card>
  );
}
