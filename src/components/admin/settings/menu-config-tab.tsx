'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Loader2, GripVertical, Menu, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface MenuItem {
  id: string;
  label: string;
  href: string;
  isVisible: boolean;
  position: number;
  children?: MenuItem[];
}

interface MenuConfig {
  id?: string;
  items: MenuItem[];
}

export function MenuConfigTab() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const menuRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'menu') : null, [firestore]);
  const { data: menuData } = useDoc<MenuConfig>(menuRef);

  const [items, setItems] = React.useState<MenuItem[]>([]);
  const [formData, setFormData] = React.useState<MenuItem>({
    id: '',
    label: '',
    href: '',
    isVisible: true,
    position: 0,
    children: [],
  });
  const [childLabel, setChildLabel] = React.useState('');
  const [childHref, setChildHref] = React.useState('');

  React.useEffect(() => {
    if (menuData?.items) {
      setItems(menuData.items.sort((a, b) => a.position - b.position));
    }
  }, [menuData]);

  const openCreate = () => {
    setEditingIndex(null);
    setFormData({
      id: `menu-${Date.now()}`,
      label: '',
      href: '',
      isVisible: true,
      position: items.length,
      children: [],
    });
    setDialogOpen(true);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setFormData({ ...items[index], children: items[index].children ? [...items[index].children!] : [] });
    setDialogOpen(true);
  };

  const addChild = () => {
    if (!childLabel.trim() || !childHref.trim()) return;
    setFormData(prev => ({
      ...prev,
      children: [...(prev.children || []), {
        id: `sub-${Date.now()}`,
        label: childLabel.trim(),
        href: childHref.trim(),
        isVisible: true,
        position: (prev.children?.length || 0),
      }],
    }));
    setChildLabel('');
    setChildHref('');
  };

  const removeChild = (childIndex: number) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children?.filter((_, i) => i !== childIndex),
    }));
  };

  const handleSaveItem = () => {
    if (!formData.label.trim()) return;
    const updated = [...items];
    if (editingIndex !== null) {
      updated[editingIndex] = formData;
    } else {
      updated.push(formData);
    }
    setItems(updated);
    setDialogOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const toggleVisibility = (index: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], isVisible: !updated[index].isVisible };
    setItems(updated);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...items];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setItems(updated.map((item, i) => ({ ...item, position: i })));
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const handlePublish = async () => {
    setIsLoading(true);
    try {
      const reordered = items.map((item, i) => ({ ...item, position: i }));
      await setDoc(doc(firestore, 'settings', 'menu'), { items: reordered });
      toast({ title: 'Menu published successfully.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error saving menu.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Menu className="h-5 w-5" /> Navigation Menu</CardTitle>
            <CardDescription>Configure the main navigation menu on the home page. Drag to reorder.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
            <Button size="sm" onClick={handlePublish} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish Menu
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">No menu items. Add items to configure the navigation.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                    dragIndex === index ? 'opacity-50 border-primary' : 'bg-background hover:bg-muted/30'
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.href}</span>
                      {!item.isVisible && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                    </div>
                    {item.children && item.children.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.children.map((child, ci) => (
                          <Badge key={ci} variant="outline" className="text-[10px] font-normal">{child.label}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleVisibility(index)}>
                      {item.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(index)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? 'Edit Menu Item' : 'New Menu Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={formData.label} onChange={e => setFormData(prev => ({ ...prev, label: e.target.value }))} placeholder="Womenswear" />
              </div>
              <div className="space-y-2">
                <Label>Link</Label>
                <Input value={formData.href} onChange={e => setFormData(prev => ({ ...prev, href: e.target.value }))} placeholder="/search?gender=women" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Visible</Label>
              <Switch checked={formData.isVisible} onCheckedChange={val => setFormData(prev => ({ ...prev, isVisible: val }))} />
            </div>

            <div className="space-y-3 pt-2">
              <Label>Submenu Items</Label>
              {formData.children && formData.children.length > 0 && (
                <div className="space-y-1.5">
                  {formData.children.map((child, ci) => (
                    <div key={ci} className="flex items-center gap-2 text-sm bg-muted/30 px-3 py-1.5 rounded">
                      <span className="font-medium flex-1">{child.label}</span>
                      <span className="text-muted-foreground text-xs">{child.href}</span>
                      <button onClick={() => removeChild(ci)} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input value={childLabel} onChange={e => setChildLabel(e.target.value)} placeholder="Sub label" className="flex-1" />
                <Input value={childHref} onChange={e => setChildHref(e.target.value)} placeholder="/link" className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={addChild}>Add</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveItem}>Save Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
