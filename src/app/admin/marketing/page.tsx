
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Plus,
  Tag,
  Truck,
  Trash2,
  Edit,
  Loader2,
  Calendar as CalendarIcon,
  Percent,
  Banknote,
  CheckCircle2,
} from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import type { FirestoreCoupon, FirestoreSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import MarketingLoading from './loading';

const CouponDialog = ({
  open,
  onOpenChange,
  coupon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon?: FirestoreCoupon | null;
}) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<FirestoreCoupon>>({
    code: '',
    type: 'percentage',
    value: 0,
    minOrderValue: 0,
    isActive: true,
    usageLimit: 0,
  });

  React.useEffect(() => {
    if (coupon) {
      setFormData(coupon);
    } else {
      setFormData({
        code: '',
        type: 'percentage',
        value: 0,
        minOrderValue: 0,
        isActive: true,
        usageLimit: 0,
      });
    }
  }, [coupon]);

  const handleSave = async () => {
    if (!formData.code || !formData.value) {
        toast({ variant: 'destructive', title: "Missing fields" });
        return;
    }
    setIsLoading(true);
    try {
      const data = {
        ...formData,
        code: formData.code.toUpperCase(),
        usedCount: coupon?.usedCount || 0,
        updatedAt: serverTimestamp(),
      };

      if (coupon?.id) {
        await updateDoc(doc(firestore, 'coupons', coupon.id), data);
        toast({ title: 'Coupon updated successfully.' });
      } else {
        await addDoc(collection(firestore, 'coupons'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Coupon created successfully.' });
      }
      onOpenChange(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error saving coupon.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{coupon ? 'Edit Coupon' : 'Create New Coupon'}</DialogTitle>
          <DialogDescription>Set up discount codes for your customers.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Coupon Code</Label>
            <Input
              placeholder="e.g. WELCOME20"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <select
                className="w-full h-10 px-3 border rounded-md"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (€)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Minimum Order Value (€)</Label>
            <Input
              type="number"
              value={formData.minOrderValue}
              onChange={(e) => setFormData({ ...formData, minOrderValue: parseFloat(e.target.value) })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Active Status</Label>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(val) => setFormData({ ...formData, isActive: val })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {coupon ? 'Update Coupon' : 'Create Coupon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function MarketingPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const couponsQuery = useMemoFirebase(() => query(collection(firestore, 'coupons'), orderBy('code')), [firestore]);
  const { data: coupons, isLoading: areCouponsLoading } = useCollection<FirestoreCoupon>(couponsQuery);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'settings', 'global'), [firestore]);
  const { data: settings, isLoading: isSettingsLoading } = useDoc<FirestoreSettings>(settingsRef);

  const [editingCoupon, setEditingCoupon] = React.useState<FirestoreCoupon | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await deleteDoc(doc(firestore, 'coupons', id));
      toast({ title: 'Coupon deleted.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error deleting coupon.' });
    }
  };

  const handleUpdateFreeDelivery = async (field: keyof FirestoreSettings, value: any) => {
    setIsSavingSettings(true);
    try {
      await updateDoc(settingsRef, { [field]: value });
      toast({ title: 'Promotion settings updated.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error updating settings.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (areCouponsLoading || isSettingsLoading) return <MarketingLoading />;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing & Promotions</h1>
          <p className="text-muted-foreground">Manage coupons and delivery campaigns.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Discount Coupons</CardTitle>
                <CardDescription>All active and inactive promo codes.</CardDescription>
              </div>
              <Button onClick={() => { setEditingCoupon(null); setIsDialogOpen(true); }} size="sm">
                <Plus className="mr-2 h-4 w-4" /> New Coupon
              </Button>
            </CardHeader>
            <CardContent>
              {coupons && coupons.length > 0 ? (
                <div className="divide-y">
                  {coupons.map((coupon) => (
                    <div key={coupon.id} className="py-4 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${coupon.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {coupon.type === 'percentage' ? <Percent className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-bold flex items-center gap-2">
                            {coupon.code}
                            {!coupon.isActive && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">INACTIVE</span>}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {coupon.type === 'percentage' ? `${coupon.value}% off` : `€${coupon.value} off`} 
                            {coupon.minOrderValue > 0 && ` on orders over €${coupon.minOrderValue}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-semibold">{coupon.usedCount} uses</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Limit: {coupon.usageLimit || '∞'}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingCoupon(coupon); setIsDialogOpen(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteCoupon(coupon.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                  <Tag className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
                  <p className="mt-4 font-medium">No coupons created yet</p>
                  <Button variant="link" onClick={() => setIsDialogOpen(true)}>Create your first promo code</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Delivery Campaigns
              </CardTitle>
              <CardDescription>Offer free shipping to your customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl border bg-primary/5">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold">Free Delivery</Label>
                  <p className="text-xs text-muted-foreground">Applies to all eligible items</p>
                </div>
                <Switch 
                  checked={settings?.isFreeDeliveryActive} 
                  onCheckedChange={(val) => handleUpdateFreeDelivery('isFreeDeliveryActive', val)}
                  disabled={isSavingSettings}
                />
              </div>

              <div className="space-y-3">
                <Label>Minimum spend for Free Delivery (€)</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    placeholder="e.g. 500" 
                    value={settings?.freeDeliveryThreshold || ''}
                    onChange={(e) => handleUpdateFreeDelivery('freeDeliveryThreshold', parseFloat(e.target.value))}
                  />
                  <Button variant="outline" size="icon" className="shrink-0" disabled={isSavingSettings}>
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Set to 0 to offer free delivery on all orders when active.
                </p>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 pt-4">
                <p className="text-[10px] text-center w-full text-muted-foreground">
                    Free delivery campaigns significantly increase conversion rates.
                </p>
            </CardFooter>
          </Card>
        </div>
      </div>

      <CouponDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        coupon={editingCoupon} 
      />
    </div>
  );
}
