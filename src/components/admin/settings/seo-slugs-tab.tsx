'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Link2, Check } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { generateProductSlug, uniqueSlug } from '@/lib/product-slug';
import { SITE_URL } from '@/lib/site';

interface Planned {
  id: string;
  title: string;
  from: string;
  to: string;
}

/**
 * Fills in `seoSlug` for listings that do not have one.
 *
 * Product URLs are `/products/{slug}` and are resolved by *querying* seoSlug,
 * so a listing without one can only be reached by its raw document id. This is
 * the same job as scripts/backfill-slugs.mjs, exposed here because that script
 * needs service-account credentials while an admin is already authenticated —
 * Firestore rules let an admin update products, so the browser can do it.
 *
 * Dry run first, always: the plan is shown before anything is written.
 */
export function SeoSlugsTab() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [scanning, setScanning] = React.useState(false);
  const [writing, setWriting] = React.useState(false);
  const [scanned, setScanned] = React.useState<number | null>(null);
  const [planned, setPlanned] = React.useState<Planned[] | null>(null);
  const [written, setWritten] = React.useState(0);

  const scan = React.useCallback(async () => {
    if (!firestore) return;
    setScanning(true);
    setPlanned(null);
    setWritten(0);
    try {
      const snap = await getDocs(collection(firestore, 'products'));
      setScanned(snap.size);

      // Seed from slugs already in use so a run cannot collide with an
      // untouched listing, or with an earlier one in this same pass.
      const taken = new Set<string>();
      snap.forEach((d) => {
        const s = (d.data() as any).seoSlug;
        if (typeof s === 'string' && s.trim()) taken.add(s.trim());
      });

      const out: Planned[] = [];
      for (const d of snap.docs) {
        const data = d.data() as any;
        const existing = typeof data.seoSlug === 'string' ? data.seoSlug.trim() : '';
        if (existing) continue;

        const base = generateProductSlug({
          id: d.id,
          title: data.title,
          brandId: data.brandId,
          color: data.color,
          size: data.size,
        });
        // Nothing to build a slug from — leave it on its id URL.
        if (!base) continue;

        const slug = await uniqueSlug(base, async (c) => taken.has(c));
        taken.add(slug);
        out.push({ id: d.id, title: data.title ?? d.id, from: existing || '(none)', to: slug });
      }
      setPlanned(out);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Scan failed', description: err?.message });
    } finally {
      setScanning(false);
    }
  }, [firestore, toast]);

  const apply = React.useCallback(async () => {
    if (!firestore || !planned?.length) return;
    setWriting(true);
    try {
      // Firestore caps a batch at 500 writes.
      for (let i = 0; i < planned.length; i += 450) {
        const batch = writeBatch(firestore);
        planned.slice(i, i + 450).forEach((p) => {
          batch.update(doc(firestore, 'products', p.id), { seoSlug: p.to });
        });
        await batch.commit();
        setWritten(Math.min(i + 450, planned.length));
      }
      toast({
        title: `${planned.length} listing${planned.length === 1 ? '' : 's'} updated.`,
        description: 'Redeploy so the sitemap picks up the new URLs.',
      });
      setPlanned([]);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Write failed', description: err?.message });
    } finally {
      setWriting(false);
    }
  }, [firestore, planned, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" /> Product URLs
        </CardTitle>
        <CardDescription>
          Listings need a stored SEO slug to get a readable URL like{' '}
          <code className="text-xs">/products/zara-orange-high-heels-coral-37</code>. Without one a
          listing still works, but only on its raw id URL. Scanning changes nothing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={scan} disabled={scanning || writing} variant="outline">
            {scanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Scan listings
          </Button>
          {planned !== null && planned.length > 0 && (
            <Button onClick={apply} disabled={writing}>
              {writing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate {planned.length} slug{planned.length === 1 ? '' : 's'}
            </Button>
          )}
          {scanned !== null && (
            <span className="text-sm text-muted-foreground">
              {scanned} listing{scanned === 1 ? '' : 's'} scanned
            </span>
          )}
        </div>

        {writing && planned && planned.length > 0 && (
          <Progress value={(written / planned.length) * 100} />
        )}

        {planned !== null && planned.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" /> Every listing already has a slug.
          </p>
        )}

        {planned !== null && planned.length > 0 && (
          <div className="space-y-2 max-h-[360px] overflow-y-auto rounded-lg border p-3 bg-muted/20">
            {planned.map((p) => (
              <div key={p.id} className="text-sm">
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground break-all">
                  {SITE_URL}/products/<span className="text-foreground">{p.to}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {planned !== null && planned.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Nothing is written until you press Generate. Existing slugs are never
            overwritten, so a listing that already ranks keeps its URL.{' '}
            <Badge variant="outline" className="ml-1">safe to re-run</Badge>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
