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
import { ArrowLeft, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, updateDoc } from 'firebase/firestore';
import type { FirestoreSettings, FirestoreCategory, FirestoreBrand, FirestoreCoupon } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import SettingsLoading from './loading';

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
  const [commissionRate, setCommissionRate] = React.useState<number | string>('');
  const [maintenanceMode, setMaintenanceMode] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Effect to populate form when data loads
  React.useEffect(() => {
      if (settings) {
          setCommissionRate(settings.commissionRate * 100);
          setMaintenanceMode(settings.maintenanceMode);
      }
  }, [settings]);

  const handleSaveSettings = async () => {
      if (!settingsRef) return;
      setIsSaving(true);
      try {
          await updateDoc(settingsRef, {
              commissionRate: Number(commissionRate) / 100,
              maintenanceMode: maintenanceMode,
          });
          toast({ title: 'Settings saved successfully!' });
      } catch (e) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not save settings.' });
      } finally {
          setIsSaving(false);
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
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your marketplace settings and configurations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          {/* Categories */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>Manage your product categories.</CardDescription>
                  </div>
                  <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {categoryTree.map(category => (
                        <div key={category.id} className="space-y-2">
                             <h4 className="font-semibold text-md">{category.name.en}</h4>
                             <div className="border rounded-md">
                                {category.subcategories.map((sub, index) => (
                                    <div key={sub.slug} className={`flex justify-between items-center p-3 ${index < category.subcategories.length - 1 ? 'border-b' : ''}`}>
                                        <span>{sub.name.en}</span>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    ))}
                </div>
            </CardContent>
          </Card>

          {/* Brands */}
           <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Brands</CardTitle>
                    <CardDescription>Manage your product brands.</CardDescription>
                  </div>
                  <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Brand
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    {(brands || []).slice(0, 5).map((brand, index) => ( // Show first 5 for brevity
                        <div key={brand.slug} className={`flex justify-between items-center p-3 ${index < 4 ? 'border-b' : ''}`}>
                            <span>{brand.name}</span>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="link" className="p-0 h-auto">View all brands...</Button>
            </CardFooter>
          </Card>

           {/* Coupons */}
           <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Coupons</CardTitle>
                    <CardDescription>Manage discount codes.</CardDescription>
                  </div>
                  <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Coupon
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    {(coupons || []).map((coupon, index) => (
                        <div key={coupon.id} className={`flex justify-between items-center p-3 ${index < (coupons?.length || 0) - 1 ? 'border-b' : ''}`}>
                            <div>
                                <span className="font-mono bg-muted text-foreground px-2 py-1 rounded-md text-sm">{coupon.code}</span>
                                <span className="ml-4 text-muted-foreground text-sm">{coupon.discountValue}{coupon.discountType === 'percentage' ? '%' : '€'} Discount</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`text-sm font-semibold ${coupon.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>{coupon.status}</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-1 space-y-8">
            <Card>
            <CardHeader>
                <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                <Label htmlFor="commission-rate">Commission Rate (%)</Label>
                <Input id="commission-rate" type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} />
                </div>
                <Separator />
                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <Label htmlFor="maintenance-mode" className="text-base">Maintenance Mode</Label>
                        <p className="text-sm text-muted-foreground">
                            Temporarily disable public access to the site.
                        </p>
                    </div>
                    <Switch id="maintenance-mode" checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
                </div>
            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={handleSaveSettings} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Settings
                </Button>
            </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  );
}
