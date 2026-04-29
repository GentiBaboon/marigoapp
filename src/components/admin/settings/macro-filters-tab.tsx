'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Save, X, Plus, Trash2, Edit } from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { MacroFilter, MacroFiltersConfig } from '@/components/home/MacroFilters';

const DEFAULT_FILTERS: MacroFilter[] = [
  { id: 'preowned', label: 'Preowned', enabled: false, productIds: [], memberIds: [] },
  { id: 'new', label: 'New', enabled: false, productIds: [], memberIds: [] },
  { id: 'luxury', label: 'Luxury', enabled: false, productIds: [], memberIds: [] },
  { id: 'influencer', label: 'Influencer', enabled: false, productIds: [], memberIds: [] },
];

interface SearchResult { id: string; label: string; }

function ItemSearch({ placeholder, onAdd, searchFn }: {
  placeholder: string;
  onAdd: (id: string) => void;
  searchFn: (q: string) => Promise<SearchResult[]>;
}) {
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  const handleSearch = async (value: string) => {
    setQ(value);
    if (value.length < 2) { setResults([]); return; }
    setLoading(true);
    setResults(await searchFn(value));
    setLoading(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input value={q} onChange={(e) => handleSearch(e.target.value)} placeholder={placeholder} className="text-sm" />
        {loading && <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground" />}
      </div>
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-background border rounded-md shadow-md max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button key={r.id} onClick={() => { onAdd(r.id); setQ(''); setResults([]); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted truncate">
              {r.label}
              <span className="text-muted-foreground text-xs ml-2">{r.id.slice(0, 8)}…</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MacroFiltersTab() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [filters, setFilters] = React.useState<MacroFilter[]>(DEFAULT_FILTERS);

  // Dialog state for add/edit filter
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingFilter, setEditingFilter] = React.useState<MacroFilter | null>(null);
  const [filterForm, setFilterForm] = React.useState({ label: '' });

  const filtersRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'macro_filters') : null),
    [firestore]
  );
  const { data } = useDoc<MacroFiltersConfig>(filtersRef);

  React.useEffect(() => {
    if (data?.filters) setFilters(data.filters);
  }, [data]);

  const updateFilter = (id: string, patch: Partial<MacroFilter>) =>
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const removeTagId = (filterId: string, type: 'productIds' | 'memberIds', itemId: string) =>
    setFilters((prev) =>
      prev.map((f) => f.id === filterId ? { ...f, [type]: f[type].filter((id) => id !== itemId) } : f)
    );

  const addTagId = (filterId: string, type: 'productIds' | 'memberIds', itemId: string) =>
    setFilters((prev) =>
      prev.map((f) =>
        f.id === filterId && !f[type].includes(itemId) ? { ...f, [type]: [...f[type], itemId] } : f
      )
    );

  const deleteFilter = (id: string) =>
    setFilters((prev) => prev.filter((f) => f.id !== id));

  const openAddDialog = () => {
    setEditingFilter(null);
    setFilterForm({ label: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (filter: MacroFilter) => {
    setEditingFilter(filter);
    setFilterForm({ label: filter.label });
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    const label = filterForm.label.trim();
    if (!label) return;
    if (editingFilter) {
      updateFilter(editingFilter.id, { label });
    } else {
      const newFilter: MacroFilter = {
        id: `filter-${Date.now()}`,
        label,
        enabled: false,
        productIds: [],
        memberIds: [],
      };
      setFilters((prev) => [...prev, newFilter]);
    }
    setDialogOpen(false);
  };

  const searchProducts = async (q: string): Promise<SearchResult[]> => {
    if (!firestore) return [];
    const snap = await getDocs(
      query(collection(firestore, 'products'), where('status', '==', 'active'), orderBy('title'), limit(8))
    );
    return snap.docs
      .map((d) => ({ id: d.id, label: d.data().title as string }))
      .filter((r) => r.label?.toLowerCase().includes(q.toLowerCase()));
  };

  const searchMembers = async (q: string): Promise<SearchResult[]> => {
    if (!firestore) return [];
    const snap = await getDocs(query(collection(firestore, 'users'), orderBy('name'), limit(20)));
    return snap.docs
      .map((d) => ({ id: d.id, label: d.data().name as string }))
      .filter((r) => r.label?.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
  };

  const handleSave = async () => {
    if (!firestore) return;
    setIsLoading(true);
    try {
      await setDoc(doc(firestore, 'settings', 'macro_filters'), { filters });
      toast({ title: 'Macro filters saved.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error saving filters.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>MacroFilters</CardTitle>
            <CardDescription>
              Toggle filters visible on the homepage and tag products or members to each.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" /> Add Filter
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filters.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-6">No filters yet. Add your first MacroFilter.</p>
          )}
          {filters.map((filter) => (
            <div key={filter.id} className="border rounded-lg p-4 space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{filter.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {filter.enabled ? 'Visible' : 'Hidden'}
                  </span>
                  <Switch
                    checked={filter.enabled}
                    onCheckedChange={(val) => updateFilter(filter.id, { enabled: val })}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(filter)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFilter(filter.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Products */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tagged Products ({filter.productIds.length})</Label>
                <ItemSearch
                  placeholder="Search products to tag…"
                  onAdd={(id) => addTagId(filter.id, 'productIds', id)}
                  searchFn={searchProducts}
                />
                {filter.productIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {filter.productIds.map((id) => (
                      <Badge key={id} variant="secondary" className="gap-1 text-xs">
                        {id.slice(0, 8)}…
                        <button onClick={() => removeTagId(filter.id, 'productIds', id)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Members */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tagged Members ({filter.memberIds.length})</Label>
                <ItemSearch
                  placeholder="Search members to tag…"
                  onAdd={(id) => addTagId(filter.id, 'memberIds', id)}
                  searchFn={searchMembers}
                />
                {filter.memberIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {filter.memberIds.map((id) => (
                      <Badge key={id} variant="secondary" className="gap-1 text-xs">
                        {id.slice(0, 8)}…
                        <button onClick={() => removeTagId(filter.id, 'memberIds', id)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add / Edit Filter Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFilter ? 'Edit Filter' : 'New MacroFilter'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Filter Name</Label>
              <Input
                value={filterForm.label}
                onChange={(e) => setFilterForm({ label: e.target.value })}
                placeholder="e.g. Vintage, Sale, Local Designers…"
                onKeyDown={(e) => e.key === 'Enter' && handleDialogSave()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDialogSave} disabled={!filterForm.label.trim()}>
              {editingFilter ? 'Save Changes' : 'Add Filter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
