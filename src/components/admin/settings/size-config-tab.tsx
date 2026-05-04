'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Loader2, X, Ruler } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { FirestoreCategory } from '@/lib/types';

interface SizeChart {
  id: string;
  categoryType: string;
  sizeSystem: string;   // "EU", "US", "UK", "IT", "FR", "International"
  sizes: string[];      // ["36", "37", "38", ...]
  isActive: boolean;
}

const SIZE_SYSTEMS = ['EU', 'US', 'UK', 'IT', 'FR', 'International'];

const DEFAULT_SIZES: Record<string, Record<string, string[]>> = {
  Shoes: {
    EU: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
    US: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12', '13'],
    UK: ['3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '10', '11'],
  },
  Clothing: {
    EU: ['34', '36', '38', '40', '42', '44', '46', '48', '50'],
    US: ['0', '2', '4', '6', '8', '10', '12', '14', '16'],
    IT: ['38', '40', '42', '44', '46', '48'],
    FR: ['34', '36', '38', '40', '42', '44'],
    International: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
  Bags: {
    International: ['Mini', 'Small', 'Medium', 'Large', 'Oversized', 'One Size'],
  },
  Accessories: {
    International: ['One Size', 'XS', 'S', 'M', 'L', 'XL'],
  },
  Watches: {
    International: ['One Size'],
  },
};

export function SizeConfigTab() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SizeChart | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const [formData, setFormData] = React.useState({
    categoryType: 'Shoes',
    sizeSystem: 'EU',
    sizes: [] as string[],
    isActive: true,
  });
  const [newSize, setNewSize] = React.useState('');

  const chartsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'size_charts') : null, [firestore]);
  const { data: charts } = useCollection<SizeChart>(chartsQuery);

  const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'categories'), orderBy('order')) : null, [firestore]);
  const { data: allCategories } = useCollection<FirestoreCategory>(categoriesQuery);
  const topLevelCategories = React.useMemo(
    () => (allCategories ?? []).filter(c => !c.parentId).map(c => c.name),
    [allCategories]
  );

  const openCreate = () => {
    setEditing(null);
    const first = topLevelCategories[0] ?? 'Shoes';
    setFormData({ categoryType: first, sizeSystem: 'EU', sizes: [], isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (chart: SizeChart) => {
    setEditing(chart);
    setFormData({
      categoryType: chart.categoryType,
      sizeSystem: chart.sizeSystem,
      sizes: [...chart.sizes],
      isActive: chart.isActive,
    });
    setDialogOpen(true);
  };

  const handleLoadDefaults = () => {
    const defaults = DEFAULT_SIZES[formData.categoryType]?.[formData.sizeSystem];
    if (defaults) {
      setFormData(prev => ({ ...prev, sizes: [...defaults] }));
      toast({ title: 'Default sizes loaded.' });
    } else {
      toast({ variant: 'destructive', title: 'No defaults for this combination.' });
    }
  };

  const addSize = () => {
    const val = newSize.trim();
    if (!val || formData.sizes.includes(val)) return;
    setFormData(prev => ({ ...prev, sizes: [...prev.sizes, val] }));
    setNewSize('');
  };

  const removeSize = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (formData.sizes.length === 0) {
      toast({ variant: 'destructive', title: 'Add at least one size.' });
      return;
    }
    setIsLoading(true);
    try {
      const payload = { ...formData };
      if (editing?.id) {
        await updateDoc(doc(firestore, 'size_charts', editing.id), payload);
        toast({ title: 'Size chart updated.' });
      } else {
        await addDoc(collection(firestore, 'size_charts'), payload);
        toast({ title: 'Size chart created.' });
      }
      setDialogOpen(false);
    } catch (err) {
      console.error('[SizeChart] save error:', err);
      toast({ variant: 'destructive', title: 'Error saving size chart.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this size chart?')) return;
    try {
      await deleteDoc(doc(firestore, 'size_charts', id));
      toast({ title: 'Deleted.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error deleting.' });
    }
  };

  const grouped = React.useMemo(() => {
    if (!charts) return {};
    const map: Record<string, SizeChart[]> = {};
    charts.forEach(c => {
      if (!map[c.categoryType]) map[c.categoryType] = [];
      map[c.categoryType].push(c);
    });
    return map;
  }, [charts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Ruler className="h-5 w-5" /> Size Charts</CardTitle>
            <CardDescription>Configure sizes by product type and size system (EU, US, UK, etc.)</CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Chart</Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.keys(grouped).length === 0 && (
            <p className="text-muted-foreground text-center py-8 text-sm">No size charts configured yet. Click &quot;Add Chart&quot; to create one.</p>
          )}
          {Object.entries(grouped).map(([type, list]) => (
            <div key={type} className="space-y-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{type}</h3>
              {list.map(chart => (
                <div key={chart.id} className="flex items-start justify-between p-3 border rounded-lg bg-muted/20">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-bold">{chart.sizeSystem}</Badge>
                      {!chart.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {chart.sizes.map((s, i) => (
                        <span key={i} className="text-xs bg-background px-2 py-0.5 rounded border font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(chart)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(chart.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Size Chart' : 'New Size Chart'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Type</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md text-sm"
                  value={formData.categoryType}
                  onChange={e => setFormData(prev => ({ ...prev, categoryType: e.target.value }))}
                >
                  {topLevelCategories.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Size System</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md text-sm"
                  value={formData.sizeSystem}
                  onChange={e => setFormData(prev => ({ ...prev, sizeSystem: e.target.value }))}
                >
                  {SIZE_SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sizes ({formData.sizes.length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleLoadDefaults}>
                  Load Defaults
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 border rounded-md bg-muted/20">
                {formData.sizes.map((s, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {s}
                    <button onClick={() => removeSize(i)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newSize}
                  onChange={e => setNewSize(e.target.value)}
                  placeholder="Add size..."
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSize(); } }}
                />
                <Button type="button" variant="outline" onClick={addSize}>Add</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Chart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
