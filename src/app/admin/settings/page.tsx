
'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Edit, Trash2, Loader2, Save } from 'lucide-react';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, updateDoc, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import type { FirestoreSettings, FirestoreCategory, FirestoreBrand, FirestoreAttribute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import SettingsLoading from './loading';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// --- Sub-components for Management ---

const CategoryDialog = ({ 
    open, 
    onOpenChange, 
    category, 
    parentCategories 
}: { 
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
    category?: FirestoreCategory | null;
    parentCategories: FirestoreCategory[];
}) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        name: '',
        slug: '',
        parentId: '',
        isActive: true,
    });

    React.useEffect(() => {
        if (category) {
            setFormData({
                name: category.name,
                slug: category.slug,
                parentId: category.parentId || '',
                isActive: category.isActive,
            });
        } else {
            setFormData({ name: '', slug: '', parentId: '', isActive: true });
        }
    }, [category]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const data = { ...formData, parentId: formData.parentId || null };
            if (category?.id) {
                await updateDoc(doc(firestore, 'categories', category.id), data);
                toast({ title: 'Category updated.' });
            } else {
                await addDoc(collection(firestore, 'categories'), data);
                toast({ title: 'Category added.' });
            }
            onOpenChange(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error saving category.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Parent Category</Label>
                        <select 
                            className="w-full h-10 px-3 border rounded-md"
                            value={formData.parentId} 
                            onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                        >
                            <option value="">None (Top Level)</option>
                            {parentCategories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Active</Label>
                        <Switch checked={formData.isActive} onCheckedChange={val => setFormData({ ...formData, isActive: val })} />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const BrandDialog = ({ open, onOpenChange, brand }: { open: boolean; onOpenChange: (open: boolean) => void; brand?: FirestoreBrand | null }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        name: '',
        slug: '',
        verified: false,
    });

    React.useEffect(() => {
        if (brand) {
            setFormData({
                name: brand.name,
                slug: brand.slug,
                verified: brand.verified || false,
            });
        } else {
            setFormData({ name: '', slug: '', verified: false });
        }
    }, [brand]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            if (brand?.id) {
                await updateDoc(doc(firestore, 'brands', brand.id), formData);
                toast({ title: 'Brand updated.' });
            } else {
                await addDoc(collection(firestore, 'brands'), formData);
                toast({ title: 'Brand added.' });
            }
            onOpenChange(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error saving brand.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{brand ? 'Edit Brand' : 'Add Brand'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Verified</Label>
                        <Switch checked={formData.verified} onCheckedChange={val => setFormData({ ...formData, verified: val })} />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const AttributeDialog = ({ 
    open, 
    onOpenChange, 
    attribute, 
    collectionName 
}: { 
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
    attribute?: FirestoreAttribute | null;
    collectionName: string;
}) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        name: '',
        value: '',
        hex: '',
    });

    React.useEffect(() => {
        if (attribute) {
            setFormData({
                name: attribute.name,
                value: attribute.value,
                hex: attribute.hex || '',
            });
        } else {
            setFormData({ name: '', value: '', hex: '' });
        }
    }, [attribute]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            if (attribute?.id) {
                await updateDoc(doc(firestore, collectionName, attribute.id), formData);
                toast({ title: 'Updated successfully.' });
            } else {
                await addDoc(collection(firestore, collectionName), formData);
                toast({ title: 'Added successfully.' });
            }
            onOpenChange(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error saving.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{attribute ? `Edit ${collectionName}` : `Add ${collectionName}`}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Label</Label>
                        <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '-') })} />
                    </div>
                    {collectionName === 'colors' && (
                        <div className="space-y-2">
                            <Label>Hex Color</Label>
                            <div className="flex gap-2">
                                <Input type="color" className="w-12 p-1" value={formData.hex} onChange={e => setFormData({ ...formData, hex: e.target.value })} />
                                <Input value={formData.hex} onChange={e => setFormData({ ...formData, hex: e.target.value })} placeholder="#FFFFFF" />
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// --- Main Page ---

export default function AdminSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Data fetching
  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'global') : null, [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc<FirestoreSettings>(settingsRef);
  
  const categoriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'categories') : null, [firestore]);
  const { data: categories } = useCollection<FirestoreCategory>(categoriesQuery);

  const brandsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'brands') : null, [firestore]);
  const { data: brands } = useCollection<FirestoreBrand>(brandsQuery);

  // Metadata collections
  const conditionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'conditions') : null, [firestore]);
  const { data: conditions } = useCollection<FirestoreAttribute>(conditionsQuery);

  const materialsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'materials') : null, [firestore]);
  const { data: materials } = useCollection<FirestoreAttribute>(materialsQuery);

  const colorsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'colors') : null, [firestore]);
  const { data: colors } = useCollection<FirestoreAttribute>(colorsQuery);

  const patternsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'patterns') : null, [firestore]);
  const { data: patterns } = useCollection<FirestoreAttribute>(patternsQuery);

  // Dialog states
  const [catDialogOpen, setCatDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<FirestoreCategory | null>(null);
  
  const [brandDialogOpen, setBrandDialogOpen] = React.useState(false);
  const [editingBrand, setEditingBrand] = React.useState<FirestoreBrand | null>(null);

  const [attrDialogOpen, setAttrDialogOpen] = React.useState(false);
  const [editingAttr, setEditingAttr] = React.useState<FirestoreAttribute | null>(null);
  const [activeAttrCollection, setActiveAttrCollection] = React.useState('conditions');

  const handleDeleteItem = async (col: string, id: string) => {
      if (!confirm('Are you sure?')) return;
      try {
          await deleteDoc(doc(firestore, col, id));
          toast({ title: 'Item deleted.' });
      } catch (e) {
          toast({ variant: 'destructive', title: 'Error deleting.' });
      }
  }

  const categoryTree = React.useMemo(() => {
    if (!categories) return [];
    const parents = categories.filter(c => !c.parentId);
    const subs = categories.filter(c => c.parentId);
    return parents.map(p => ({ ...p, subcategories: subs.filter(s => s.parentId === p.id) }));
  }, [categories]);

  if (settingsLoading) return <SettingsLoading />;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace Settings</h1>
          <p className="text-muted-foreground">Manage categories, brands, and item attributes.</p>
        </div>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="brands">Brands</TabsTrigger>
            <TabsTrigger value="attributes">Attributes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="categories" className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Product Categories</CardTitle>
                        <CardDescription>Hierarchy for your marketplace.</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => { setEditingCategory(null); setCatDialogOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Add Category
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {categoryTree.map(cat => (
                        <div key={cat.id} className="space-y-2">
                            <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md">
                                <h4 className="font-bold">{cat.name}</h4>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => { setEditingCategory(cat); setCatDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteItem('categories', cat.id)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                            <div className="ml-6 space-y-1">
                                {cat.subcategories.map(sub => (
                                    <div key={sub.id} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-md">
                                        <span>{sub.name}</span>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => { setEditingCategory(sub); setCatDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteItem('categories', sub.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="brands" className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Designer Brands</CardTitle>
                        <CardDescription>List of available brands.</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => { setEditingBrand(null); setBrandDialogOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Add Brand
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {brands?.map(brand => (
                            <div key={brand.id} className="flex justify-between items-center p-2 border rounded-md">
                                <span className="font-medium text-sm">{brand.name}</span>
                                <div className="flex">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingBrand(brand); setBrandDialogOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteItem('brands', brand.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="attributes" className="space-y-6">
            {['conditions', 'materials', 'colors', 'patterns'].map(col => (
                <Card key={col}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="capitalize">{col}</CardTitle>
                        <Button size="sm" onClick={() => { setActiveAttrCollection(col); setEditingAttr(null); setAttrDialogOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" /> Add
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {(col === 'conditions' ? conditions : col === 'materials' ? materials : col === 'colors' ? colors : patterns)?.map(attr => (
                                <div key={attr.id} className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
                                    {col === 'colors' && attr.hex && <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: attr.hex }} />}
                                    <span className="text-xs font-medium">{attr.name}</span>
                                    <button onClick={() => { setActiveAttrCollection(col); setEditingAttr(attr); setAttrDialogOpen(true); }}><Edit className="h-3 w-3 text-muted-foreground" /></button>
                                    <button onClick={() => handleDeleteItem(col, attr.id)}><Trash2 className="h-3 w-3 text-destructive" /></button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </TabsContent>
      </Tabs>

      <CategoryDialog open={catDialogOpen} onOpenChange={setCatDialogOpen} category={editingCategory} parentCategories={categories?.filter(c => !c.parentId) || []} />
      <BrandDialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen} brand={editingBrand} />
      <AttributeDialog open={attrDialogOpen} onOpenChange={setAttrDialogOpen} attribute={editingAttr} collectionName={activeAttrCollection} />
    </div>
  );
}
