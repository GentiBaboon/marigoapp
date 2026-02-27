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
import type { FirestoreSettings, FirestoreCategory, FirestoreBrand, FirestoreCoupon } from '@/lib/types';
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
                        <Label>Parent Category (optional)</Label>
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

// --- Main Page ---

export default function AdminSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Data fetching
  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'global') : null, [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc<FirestoreSettings>(settingsRef);
  
  const categoriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'categories') : null, [firestore]);
  const { data: categories, isLoading: categoriesLoading } = useCollection<FirestoreCategory>(categoriesQuery);

  const brandsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'brands') : null, [firestore]);
  const { data: brands, isLoading: brandsLoading } = useCollection<FirestoreBrand>(brandsQuery);

  const couponsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'coupons') : null, [firestore]);
  const { data: coupons, isLoading: couponsLoading } = useCollection<FirestoreCoupon>(couponsQuery);

  // State for form inputs
  const [globalSettings, setGlobalSettings] = React.useState<Partial<FirestoreSettings>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  // Dialog states
  const [catDialogOpen, setCatDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<FirestoreCategory | null>(null);
  const [brandDialogOpen, setBrandDialogOpen] = React.useState(false);
  const [editingBrand, setEditingBrand] = React.useState<FirestoreBrand | null>(null);

  // Effect to populate form when data loads
  React.useEffect(() => {
      if (settings) {
          setGlobalSettings(settings);
      }
  }, [settings]);

  const handleSaveSettings = async () => {
      if (!settingsRef) return;
      setIsSaving(true);
      try {
          await setDoc(settingsRef, globalSettings, { merge: true });
          toast({ title: 'Global settings saved successfully!' });
      } catch (e) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not save settings.' });
      } finally {
          setIsSaving(false);
      }
  }

  const handleDeleteItem = async (col: string, id: string) => {
      if (!confirm('Are you sure you want to delete this item?')) return;
      try {
          await deleteDoc(doc(firestore, col, id));
          toast({ title: 'Item deleted.' });
      } catch (e) {
          toast({ variant: 'destructive', title: 'Error deleting item.' });
      }
  }

  const categoryTree = React.useMemo(() => {
    if (!categories) return [];
    const parentCategories = categories.filter(c => !c.parentId);
    const subCategories = categories.filter(c => c.parentId);

    return parentCategories.map(p => ({
        ...p,
        subcategories: subCategories.filter(s => s.parentId === p.id)
    }));
  }, [categories]);

  const isLoading = settingsLoading || categoriesLoading || brandsLoading || couponsLoading;

  if (isLoading) {
      return <SettingsLoading />;
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your marketplace settings, categories, and brands.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          
          <Tabs defaultValue="categories" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="categories">Categories</TabsTrigger>
                <TabsTrigger value="brands">Brands</TabsTrigger>
            </TabsList>
            
            <TabsContent value="categories" className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Categories</CardTitle>
                                <CardDescription>Organize your products into groups.</CardDescription>
                            </div>
                            <Button size="sm" onClick={() => { setEditingCategory(null); setCatDialogOpen(true); }}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Category
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {categoryTree.map(category => (
                                <div key={category.id} className="space-y-2">
                                    <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md">
                                        <h4 className="font-semibold text-md">{category.name}</h4>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCategory(category); setCatDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteItem('categories', category.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                    <div className="ml-4 border-l-2 pl-4 space-y-2">
                                        {category.subcategories.map((sub) => (
                                            <div key={sub.id} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-md">
                                                <span>{sub.name} <span className="text-xs text-muted-foreground">({sub.slug})</span></span>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCategory(sub); setCatDialogOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteItem('categories', sub.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            </div>
                                        ))}
                                        {category.subcategories.length === 0 && <p className="text-xs text-muted-foreground italic">No subcategories</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="brands" className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Brands</CardTitle>
                                <CardDescription>Manage the luxury brands on your site.</CardDescription>
                            </div>
                            <Button size="sm" onClick={() => { setEditingBrand(null); setBrandDialogOpen(true); }}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Brand
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(brands || []).map((brand) => (
                                <div key={brand.id} className="flex justify-between items-center p-3 border rounded-md">
                                    <div>
                                        <p className="font-medium">{brand.name}</p>
                                        {brand.verified && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded uppercase font-bold">Verified</span>}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingBrand(brand); setBrandDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteItem('brands', brand.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>

        </div>
        
        <div className="lg:col-span-1 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Platform Settings</CardTitle>
                    <CardDescription>Global configuration for MarigoApp.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Commission Rate (%)</Label>
                        <Input 
                            type="number" 
                            value={(globalSettings.commissionRate || 0) * 100} 
                            onChange={(e) => setGlobalSettings({ ...globalSettings, commissionRate: Number(e.target.value) / 100 })} 
                        />
                    </div>
                    <Separator />
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Image Upload Config</h4>
                        <div className="space-y-2">
                            <Label>Max Dimension (px)</Label>
                            <Input 
                                type="number" 
                                placeholder="e.g. 1920"
                                value={globalSettings.imageMaxDimension || 1920} 
                                onChange={(e) => setGlobalSettings({ ...globalSettings, imageMaxDimension: Number(e.target.value) })} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Max Size (MB)</Label>
                            <Input 
                                type="number" 
                                step="0.1"
                                placeholder="e.g. 0.8"
                                value={globalSettings.imageMaxSizeMB || 0.8} 
                                onChange={(e) => setGlobalSettings({ ...globalSettings, imageMaxSizeMB: Number(e.target.value) })} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Compression Quality (0-1)</Label>
                            <Input 
                                type="number" 
                                step="0.1"
                                placeholder="e.g. 0.8"
                                value={globalSettings.imageCompressionQuality || 0.8} 
                                onChange={(e) => setGlobalSettings({ ...globalSettings, imageCompressionQuality: Number(e.target.value) })} 
                            />
                        </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label className="text-base">Maintenance Mode</Label>
                            <p className="text-xs text-muted-foreground">
                                Disable public access to the storefront.
                            </p>
                        </div>
                        <Switch 
                            checked={globalSettings.maintenanceMode || false} 
                            onCheckedChange={val => setGlobalSettings({ ...globalSettings, maintenanceMode: val })} 
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full" onClick={handleSaveSettings} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Platform Changes
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>

      <CategoryDialog 
        open={catDialogOpen} 
        onOpenChange={setCatDialogOpen} 
        category={editingCategory} 
        parentCategories={categories?.filter(c => !c.parentId) || []} 
      />
      
      <BrandDialog 
        open={brandDialogOpen} 
        onOpenChange={setBrandDialogOpen} 
        brand={editingBrand} 
      />
    </div>
  );
}
