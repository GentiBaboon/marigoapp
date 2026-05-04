'use client';
import { useSellForm } from '../SellFormContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sparkles, MapPin, Truck, Plus, Edit, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { FirestoreAddress } from '@/lib/types';
import { AddressForm } from '@/components/profile/address-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';

export function PricingStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [price, setPrice] = useState(formData.price?.toString() || '');
  // Default to 1 — most listings on a resale marketplace are unique pieces.
  const [quantity, setQuantity] = useState((formData.quantity ?? 1).toString());
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(formData.shippingFromAddressId);
  const [isAddrDialogOpen, setIsAddrDialogOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const platformFeeRate = 0.15;
  const currentPrice = parseFloat(price) || 0;
  const fee = currentPrice * platformFeeRate;
  const earnings = currentPrice - fee;

  // Fetch user addresses
  const addressesCollection = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'addresses');
  }, [user, firestore]);

  const { data: addresses, isLoading: areAddressesLoading } = useCollection<FirestoreAddress>(addressesCollection);

  useEffect(() => {
    // Auto-select default address if none is set
    if (!selectedAddressId && addresses && addresses.length > 0) {
        const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
        setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses, selectedAddressId]);

  // Parse quantity → positive integer, default 1.
  const parsedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  useEffect(() => {
    setFormData({
        price: currentPrice,
        quantity: parsedQuantity,
        shippingFromAddressId: selectedAddressId
    });
  }, [price, selectedAddressId, setFormData, currentPrice, parsedQuantity]);

  const selectedAddress = addresses?.find(a => a.id === selectedAddressId);

  const canContinue = currentPrice > 0 && parsedQuantity >= 1 && !!selectedAddressId;

  return (
    <div className="space-y-8 pb-20">
      {/* Price Section */}
      <div className="space-y-4">
        <Label className="text-lg font-bold">Set your price</Label>
        <div className="relative">
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-20 text-4xl font-bold pl-12"
            placeholder="0"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">€</span>
        </div>
      </div>

      {/* Quantity Section */}
      <div className="space-y-2">
        <Label className="text-base font-bold">Quantity</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={() => setQuantity((prev) => String(Math.max(1, Math.floor(Number(prev) || 1) - 1)))}
            disabled={parsedQuantity <= 1}
            aria-label="Decrease quantity"
          >
            –
          </Button>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onBlur={() => setQuantity(String(parsedQuantity))}
            className="h-12 w-24 text-center text-lg font-semibold"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={() => setQuantity((prev) => String(Math.max(1, Math.floor(Number(prev) || 1) + 1)))}
            aria-label="Increase quantity"
          >
            +
          </Button>
          <p className="text-sm text-muted-foreground">
            {parsedQuantity === 1 ? 'Unique item' : `${parsedQuantity} pieces available`}
          </p>
        </div>
      </div>

      <div className="bg-primary/5 rounded-xl p-6 border border-primary/10 space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Platform fee (15%)</span>
          <span className="font-medium text-destructive">- €{fee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-lg font-bold">
          <span>You will receive</span>
          <span className="text-green-600">€{earnings.toFixed(2)}</span>
        </div>
      </div>

      <div className="p-4 bg-muted/30 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Sparkles className="h-4 w-4" />
          <span>IA Price Suggestion</span>
        </div>
        <p className="text-sm text-muted-foreground">Based on similar {formData.brandId} items, we suggest pricing between <span className="font-bold text-foreground">€280 - €350</span> for a faster sale.</p>
        <Button variant="outline" size="sm" onClick={() => setPrice('320')}>Apply €320</Button>
      </div>

      <div className="space-y-6">
        {/* Offers Toggle */}
        <div className="flex items-center justify-between py-2 border-b pb-4">
          <div className="space-y-0.5">
            <Label className="text-base font-bold">Allow offers</Label>
            <p className="text-sm text-muted-foreground">Let buyers negotiate the price</p>
          </div>
          <Switch checked={formData.allowOffers} onCheckedChange={(v) => setFormData({ allowOffers: v })} />
        </div>

        {/* Shipping Details */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2 text-lg font-bold">
            <Truck className="h-5 w-5" />
            Shipping details
          </Label>
          <div className="grid gap-4">
            <select 
              className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm font-medium"
              value={formData.shippingMethod || 'baboon'}
              onChange={(e) => setFormData({ shippingMethod: e.target.value as any })}
            >
              <option value="baboon">Baboon Delivery (€5.00 - Recommended)</option>
              <option value="other">Other courier</option>
              <option value="free">Free shipping</option>
            </select>
          </div>

          {/* Shipping From Address */}
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Shipping from</Label>
            
            {areAddressesLoading ? (
                <Skeleton className="h-24 w-full rounded-xl" />
            ) : selectedAddress ? (
                <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/10">
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-bold">{selectedAddress.fullName}</p>
                            <p className="text-muted-foreground leading-tight">{selectedAddress.address}, {selectedAddress.city}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-primary font-bold" onClick={() => setIsAddrDialogOpen(true)}>
                        Change
                    </Button>
                </div>
            ) : (
                <Button variant="outline" className="w-full h-16 border-dashed border-2 rounded-xl" onClick={() => { setIsAddingNew(true); setIsAddrDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Add shipping address
                </Button>
            )}
          </div>
        </div>
      </div>

      <Button 
        className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20" 
        size="lg" 
        disabled={!canContinue} 
        onClick={nextStep}
      >
        Review Listing
      </Button>

      {/* Address Selection Dialog */}
      <Dialog open={isAddrDialogOpen} onOpenChange={setIsAddrDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{isAddingNew ? 'Add New Address' : 'Select Shipping Address'}</DialogTitle>
                <DialogDescription>Where will you be shipping this item from?</DialogDescription>
            </DialogHeader>
            
            {isAddingNew ? (
                <div className="py-4">
                    {user && <AddressForm userId={user.uid} onSave={() => { setIsAddingNew(false); setIsAddrDialogOpen(false); }} />}
                    <Button variant="ghost" className="w-full mt-2" onClick={() => setIsAddingNew(false)}>Back to list</Button>
                </div>
            ) : (
                <div className="space-y-4 py-4">
                    <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId} className="grid gap-3">
                        {addresses?.map((addr) => (
                            <Label 
                                key={addr.id} 
                                className={cn(
                                    "flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all",
                                    selectedAddressId === addr.id ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/30"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <RadioGroupItem value={addr.id} />
                                    <div className="text-sm">
                                        <p className="font-bold">{addr.fullName}</p>
                                        <p className="text-muted-foreground text-xs">{addr.address}, {addr.city}</p>
                                    </div>
                                </div>
                                {selectedAddressId === addr.id && <Check className="h-4 w-4 text-primary" />}
                            </Label>
                        ))}
                    </RadioGroup>
                    <Button variant="outline" className="w-full" onClick={() => setIsAddingNew(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Add new address
                    </Button>
                    <Button className="w-full mt-4" onClick={() => setIsAddrDialogOpen(false)}>Confirm Selection</Button>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
