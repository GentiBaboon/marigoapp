'use client';
import { useSellForm } from '../SellFormContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sparkles, MapPin, Truck, Plus, Edit, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { FirestoreAddress, FirestoreUser, ProductVariant } from '@/lib/types';
import { canUseVariants, DEFAULT_SHIPPING_FEE_EUR } from '@/lib/types';
import { useCurrency } from '@/context/CurrencyContext';
import { useBadgeSettings } from '@/hooks/use-badge-settings';
import { resolveSizeOptions, resolveSizeSystems } from '@/lib/size-options';
import { Trash2 } from 'lucide-react';
import { AddressForm } from '@/components/profile/address-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export function PricingStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const { user } = useUser();
  const firestore = useFirestore();
  const { formatPrice } = useCurrency();
  
  const [price, setPrice] = useState(formData.price?.toString() || '');
  const [originalPrice, setOriginalPrice] = useState(formData.originalPrice?.toString() || '');
  // Default to 1 — most listings on a resale marketplace are unique pieces.
  const [quantity, setQuantity] = useState((formData.quantity ?? 1).toString());
  // Per-size variant inventory. Only Official Registered Brand sellers see
  // this UI; everyone else just edits the single quantity field above. All
  // variants share a single size system (EU / US / ...) — switching it
  // resets the per-row size labels.
  const [variants, setVariants] = useState<ProductVariant[]>(formData.variants ?? []);
  const [variantSizeSystem, setVariantSizeSystem] = useState<string>(formData.sizeSystem ?? '');
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(formData.shippingFromAddressId);
  const [isAddrDialogOpen, setIsAddrDialogOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const platformFeeRate = 0.15;
  const currentPrice = parseFloat(price) || 0;
  const fee = currentPrice * platformFeeRate;
  const earnings = currentPrice - fee;
  const parsedOriginalPrice = parseFloat(originalPrice) || 0;
  // Only treat it as a real "original price" if it's higher than the asking
  // price — otherwise the strikethrough makes no sense.
  const hasDiscount = parsedOriginalPrice > currentPrice && currentPrice > 0;
  const discountPercent = hasDiscount
    ? Math.round(((parsedOriginalPrice - currentPrice) / parsedOriginalPrice) * 100)
    : 0;

  // Fetch the seller's own user doc + the per-tier "variants enabled" toggle
  // configured by admin. Whether this seller sees the multi-variant per-size
  // inventory UI is driven by canUseVariants(), so admins can enable variants
  // for tiers beyond Official without touching code.
  const userRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: sellerProfile } = useDoc<FirestoreUser>(userRef);
  const { data: badgeSettings } = useBadgeSettings();
  const isOfficialBrand = canUseVariants(sellerProfile, badgeSettings);

  // Size charts to drive variant-row size dropdowns.
  const sizeChartsQuery = useMemoFirebase(() => collection(firestore, 'size_charts'), [firestore]);
  const { data: sizeChartsRaw } = useCollection<{ id: string; categoryType: string; sizeSystem: string; sizes: string[]; isActive?: boolean }>(sizeChartsQuery);
  // Same resolution as DetailsStep (admin chart → preset → universal), so a
  // category with no configured chart still gets a dropdown here instead of a
  // free-text box.
  const variantSystems = resolveSizeSystems(formData.categoryId, sizeChartsRaw);
  const variantSizeOptions = resolveSizeOptions({
    categoryType: formData.categoryId,
    sizeSystem: variantSizeSystem,
    charts: sizeChartsRaw,
  });

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

  // For multi-variant listings, total inventory = sum of variant quantities.
  // We persist BOTH `variants` (per-size detail) and `quantity` (the rolled-up
  // total) so existing readers — search, cards, the cart, and stock-decrement
  // at checkout — keep working without any awareness of variants.
  const useVariants = isOfficialBrand && variants.length > 0;
  const variantTotal = variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
  const effectiveQuantity = useVariants ? Math.max(0, variantTotal) : parsedQuantity;

  useEffect(() => {
    setFormData({
        price: currentPrice,
        // Store originalPrice only when it's a meaningful discount. Anything
        // else (blank, zero, or below the asking price) is persisted as null
        // so the strikethrough doesn't render on the storefront.
        originalPrice: hasDiscount ? parsedOriginalPrice : undefined,
        quantity: Math.max(1, effectiveQuantity),
        variants: useVariants ? variants : undefined,
        // Persist the variants' size system so ReviewStep can attach it to
        // the product doc — drives the size guide on the product page and
        // the size facet on search.
        sizeSystem: useVariants && variantSizeSystem ? variantSizeSystem : (formData.sizeSystem || undefined),
        shippingFromAddressId: selectedAddressId
    });
  }, [price, originalPrice, selectedAddressId, setFormData, currentPrice, parsedOriginalPrice, hasDiscount, parsedQuantity, useVariants, variants, effectiveQuantity, variantSizeSystem, formData.sizeSystem]);

  const addVariant = () => setVariants(prev => [...prev, { size: '', quantity: 1 }]);
  const removeVariant = (i: number) => setVariants(prev => prev.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, patch: Partial<ProductVariant>) =>
    setVariants(prev => prev.map((v, idx) => idx === i ? { ...v, ...patch } : v));

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

        {/* Optional original / retail price for a discount display */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="originalPrice" className="text-sm font-semibold">Original price <span className="text-muted-foreground font-normal">(optional)</span></Label>
            {/* Sized with the label opposite it, not a price — this row of the
                sell form has no price figure to match. */}
            {hasDiscount && (
              <span className="text-sm font-bold text-green-700">−{discountPercent}% off</span>
            )}
          </div>
          <div className="relative">
            <Input
              id="originalPrice"
              type="number"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              className="h-12 pl-10"
              placeholder="Retail price"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">€</span>
          </div>
          <p className="text-xs text-muted-foreground">
            If set higher than your asking price, buyers see it crossed out next to the current price.
          </p>
        </div>
      </div>

      {/* Quantity / Variants Section */}
      {isOfficialBrand ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label className="text-base font-bold">Inventory by size</Label>
            <span className="text-xs text-muted-foreground">{variantTotal} total in stock</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Pick a size system, then add one row per size you stock. Buyers see a size picker with per-size availability on the product page.
          </p>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Size system</Label>
            <Select
              value={variantSizeSystem || ''}
              onValueChange={(v) => {
                setVariantSizeSystem(v);
                // Switching systems invalidates per-row sizes — clear them so
                // the seller picks fresh values that exist in the new chart.
                setVariants((prev) => prev.map((row) => ({ ...row, size: '' })));
              }}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="System" />
              </SelectTrigger>
              <SelectContent>
                {variantSystems.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {variants.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No size variants yet. Add your first size below.
            </div>
          ) : (
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={v.size || ''}
                    onValueChange={(val) => updateVariant(i, { size: val })}
                  >
                    <SelectTrigger className="h-11 flex-1">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      {variantSizeOptions
                        .filter(o => o.value === v.size || !variants.some(other => other !== v && other.size === o.value))
                        .map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Qty"
                    value={String(v.quantity ?? 0)}
                    onChange={(e) => updateVariant(i, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    className="h-11 w-24 text-center"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-muted-foreground hover:text-destructive"
                    onClick={() => removeVariant(i)}
                    aria-label="Remove variant"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button type="button" variant="outline" onClick={addVariant} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add size
          </Button>
        </div>
      ) : (
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
      )}

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
          {/* Delivery is a flat platform fee paid by the buyer — the seller
              has no courier choice to make, so there is nothing to pick here. */}
          <p className="text-sm text-muted-foreground">
            Delivery is handled by Marigo. Buyers pay a flat {formatPrice(DEFAULT_SHIPPING_FEE_EUR)} delivery fee at checkout — it does not come out of your earnings.
          </p>

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
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto pb-0">
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
