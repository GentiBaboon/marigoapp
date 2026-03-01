'use client';
import { useSellForm } from '../SellFormContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Info, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export function PricingStep() {
  const { formData, setFormData, nextStep } = useSellForm();
  const [price, setPrice] = useState(formData.price?.toString() || '');
  
  const platformFeeRate = 0.15;
  const currentPrice = parseFloat(price) || 0;
  const fee = currentPrice * platformFeeRate;
  const earnings = currentPrice - fee;

  useEffect(() => {
    setFormData({ price: currentPrice });
  }, [price, setFormData, currentPrice]);

  return (
    <div className="space-y-8 pb-20">
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
        <p className="text-sm text-muted-foreground">Based on similar {formData.brand} items, we suggest pricing between <span className="font-bold text-foreground">€280 - €350</span> for a faster sale.</p>
        <Button variant="outline" size="sm" onClick={() => setPrice('320')}>Apply €320</Button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label className="text-base">Allow offers</Label>
            <p className="text-sm text-muted-foreground">Let buyers negotiate the price</p>
          </div>
          <Switch checked={formData.allowOffers} onCheckedChange={(v) => setFormData({ allowOffers: v })} />
        </div>

        <div className="space-y-4">
          <Label className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Shipping details
          </Label>
          <div className="grid gap-4">
            <select 
              className="w-full h-12 rounded-md border border-input bg-background px-3"
              value={formData.shippingMethod}
              onChange={(e) => setFormData({ shippingMethod: e.target.value as any })}
            >
              <option value="baboon">Baboon Delivery (€5.00 - Recommended)</option>
              <option value="other">Other courier</option>
              <option value="free">Free shipping</option>
            </select>
          </div>
        </div>
      </div>

      <Button className="w-full h-14 text-lg" size="lg" disabled={!currentPrice} onClick={nextStep}>
        Review Listing
      </Button>
    </div>
  );
}
