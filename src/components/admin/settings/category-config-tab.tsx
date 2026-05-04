'use client';

import * as React from 'react';
import { doc, collection, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ChevronUp, ChevronDown, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { FirestoreCategory } from '@/lib/types';

interface CategoryNode extends FirestoreCategory {
  subcategories: FirestoreCategory[];
}

interface Props {
  categories: FirestoreCategory[];
  firestore: any;
  toast: (opts: { title: string; variant?: 'destructive' }) => void;
}

interface CategoryDialogState {
  open: boolean;
  category: FirestoreCategory | null;
  parentId: string | null;
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[&]/g, 'and').replace(/['/]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function CategoryConfigTab({ categories, firestore, toast }: Props) {
  const [dialog, setDialog] = React.useState<CategoryDialogState>({ open: false, category: null, parentId: null });
  const [formName, setFormName] = React.useState('');
  const [formParentId, setFormParentId] = React.useState<string>('none');

  // Build sorted tree
  const tree = React.useMemo((): CategoryNode[] => {
    const parents = [...categories.filter(c => !c.parentId)].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    return parents.map(p => ({
      ...p,
      subcategories: [...categories.filter(c => c.parentId === p.id)].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    }));
  }, [categories]);

  const parents = tree;

  // ── Reorder helpers ──────────────────────────────────────────────────────────
  async function swapOrder(a: FirestoreCategory, b: FirestoreCategory) {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    await Promise.all([
      updateDoc(doc(firestore, 'categories', a.id), { order: orderB }),
      updateDoc(doc(firestore, 'categories', b.id), { order: orderA }),
    ]);
  }

  async function moveParent(idx: number, dir: -1 | 1) {
    const target = parents[idx + dir];
    if (!target) return;
    await swapOrder(parents[idx], target);
  }

  async function moveChild(parent: CategoryNode, idx: number, dir: -1 | 1) {
    const subs = parent.subcategories;
    const target = subs[idx + dir];
    if (!target) return;
    await swapOrder(subs[idx], target);
  }

  // ── Dialog helpers ────────────────────────────────────────────────────────────
  function openAdd(parentId: string | null) {
    setFormName('');
    setFormParentId(parentId ?? 'none');
    setDialog({ open: true, category: null, parentId });
  }

  function openEdit(cat: FirestoreCategory) {
    setFormName(cat.name);
    setFormParentId(cat.parentId ?? 'none');
    setDialog({ open: true, category: cat, parentId: cat.parentId ?? null });
  }

  async function handleSave() {
    if (!formName.trim()) return;
    const parentId = formParentId === 'none' ? null : formParentId;
    try {
      if (dialog.category) {
        await updateDoc(doc(firestore, 'categories', dialog.category.id), {
          name: formName.trim(),
          slug: slugify(formName.trim()),
          ...(parentId !== undefined && { parentId }),
        });
      } else {
        // Compute next order value
        const siblings = parentId
          ? categories.filter(c => c.parentId === parentId)
          : categories.filter(c => !c.parentId);
        const maxOrder = siblings.reduce((m, c) => Math.max(m, c.order ?? 0), 0);
        await addDoc(collection(firestore, 'categories'), {
          name: formName.trim(),
          slug: slugify(formName.trim()),
          parentId: parentId ?? null,
          isActive: true,
          order: maxOrder + 1,
        });
      }
      toast({ title: dialog.category ? 'Category updated.' : 'Category added.' });
      setDialog({ open: false, category: null, parentId: null });
    } catch {
      toast({ title: 'Error saving category.', variant: 'destructive' });
    }
  }

  async function toggleHomepageVisible(cat: FirestoreCategory, visible: boolean) {
    try {
      await updateDoc(doc(firestore, 'categories', cat.id), { homepageVisible: visible });
    } catch {
      toast({ title: 'Error updating homepage visibility.', variant: 'destructive' });
    }
  }

  async function handleDelete(cat: FirestoreCategory) {
    if (!confirm('Delete this category?')) return;
    try {
      await deleteDoc(doc(firestore, 'categories', cat.id));
      toast({ title: 'Category deleted.' });
    } catch {
      toast({ title: 'Error deleting.', variant: 'destructive' });
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Product Categories</CardTitle>
            <CardDescription>
              Reorder parent categories and subcategories. Use the homepage toggle to hide a parent
              from the homepage "Shop by Category" tabs.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => openAdd(null)}>
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {parents.map((cat, pi) => (
            <div key={cat.id} className="space-y-1">
              {/* Parent row */}
              <div className="flex items-center gap-1 bg-muted/30 px-2 py-1.5 rounded-md">
                <div className="flex flex-col mr-1">
                  <Button variant="ghost" size="icon" className="h-5 w-5" disabled={pi === 0} onClick={() => moveParent(pi, -1)}>
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" disabled={pi === parents.length - 1} onClick={() => moveParent(pi, 1)}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <h4 className="font-bold flex-1 text-sm">{cat.name}</h4>
                <div className="flex items-center gap-1.5 mr-1" title="Show in homepage Shop by Category">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Homepage</span>
                  <Switch
                    checked={cat.homepageVisible !== false}
                    onCheckedChange={(checked) => toggleHomepageVisible(cat, checked)}
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAdd(cat.id)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Subcategory rows */}
              <div className="ml-8 space-y-0.5">
                {cat.subcategories.map((sub, si) => (
                  <div key={sub.id} className="flex items-center gap-1 px-2 py-1 hover:bg-muted/40 rounded-md">
                    <div className="flex flex-col mr-1">
                      <Button variant="ghost" size="icon" className="h-4 w-4" disabled={si === 0} onClick={() => moveChild(cat, si, -1)}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-4 w-4" disabled={si === cat.subcategories.length - 1} onClick={() => moveChild(cat, si, 1)}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-sm flex-1">{sub.name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sub)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(sub)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialog.open} onOpenChange={open => setDialog(d => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.category ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Category name" />
            </div>
            <div className="space-y-1">
              <Label>Parent category</Label>
              <Select value={formParentId} onValueChange={setFormParentId}>
                <SelectTrigger><SelectValue placeholder="Top-level (no parent)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Top-level (no parent)</SelectItem>
                  {parents.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(d => ({ ...d, open: false }))}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
