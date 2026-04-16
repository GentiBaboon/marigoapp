'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase, useUser, useCollection } from '@/firebase';
import type {
  FirestoreProduct,
  FirestoreCategory,
  FirestoreAttribute,
  FirestoreBrand,
  FirestoreAddress,
  ProductImage,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Loader2,
  Save,
  Wand2,
  Truck,
  MapPin,
  Plus,
  Check,
  X,
  ImagePlus,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import NextImage from 'next/image';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AddressForm } from '@/components/profile/address-form';
import { Alert, AlertDescription } from '@/components/ui/alert';

const GENDER_OPTIONS = [
  { value: 'women', label: 'Womenswear' },
  { value: 'men', label: 'Menswear' },
  { value: 'children', label: 'Children' },
  { value: 'unisex', label: 'Unisex' },
] as const;

const ORIGIN_OPTIONS = [
  { value: 'direct', label: 'Direct from brand' },
  { value: 'private', label: 'Private sale or staff sale' },
  { value: 'vestiaire', label: 'Bought on Vestiaire Collective' },
  { value: 'other', label: 'Other' },
];

const PACKAGING_ITEMS = [
  { id: 'card', label: 'Card or certificate' },
  { id: 'dustBag', label: 'Dust bag' },
  { id: 'box', label: 'Original box' },
];

const PLATFORM_FEE = 0.15;
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => String(currentYear - i));

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  // ── Product Data ──
  const productRef = useMemoFirebase(() => {
    if (!firestore || !productId) return null;
    return doc(firestore, 'products', productId);
  }, [firestore, productId]);
  const { data: product, isLoading: isProductLoading } = useDoc<FirestoreProduct>(productRef);

  // ── Dynamic Metadata ──
  const categoriesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'categories'), where('isActive', '==', true)) : null),
    [firestore]
  );
  const brandsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'brands') : null),
    [firestore]
  );
  const conditionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'conditions') : null),
    [firestore]
  );
  const materialsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'materials') : null),
    [firestore]
  );
  const colorsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'colors') : null),
    [firestore]
  );
  const patternsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'patterns') : null),
    [firestore]
  );
  const addressesCollection = useMemoFirebase(
    () => (user && firestore ? collection(firestore, 'users', user.uid, 'addresses') : null),
    [user, firestore]
  );

  const { data: categories } = useCollection<FirestoreCategory>(categoriesQuery);
  const { data: brands } = useCollection<FirestoreBrand>(brandsQuery);
  const { data: conditions } = useCollection<FirestoreAttribute>(conditionsQuery);
  const { data: materials } = useCollection<FirestoreAttribute>(materialsQuery);
  const { data: colors } = useCollection<FirestoreAttribute>(colorsQuery);
  const { data: patterns } = useCollection<FirestoreAttribute>(patternsQuery);
  const { data: addresses } = useCollection<FirestoreAddress>(addressesCollection);

  // ── Category Tree for Combobox ──
  const categoryTree = React.useMemo(() => {
    if (!categories) return [];
    const parents = categories.filter(c => !c.parentId);
    const subs = categories.filter(c => c.parentId);
    return parents
      .map(p => ({
        heading: p.name,
        items: subs.filter(s => s.parentId === p.id).map(s => ({ value: s.slug, label: s.name })),
      }))
      .filter(g => g.items.length > 0);
  }, [categories]);

  // ── Form State ──
  const [images, setImages] = React.useState<ProductImage[]>([]);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);

  const [gender, setGender] = React.useState<string>('women');
  const [subcategoryId, setSubcategoryId] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [brandId, setBrandId] = React.useState('');

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [origin, setOrigin] = React.useState('');
  const [yearOfPurchase, setYearOfPurchase] = React.useState('');
  const [serialNumber, setSerialNumber] = React.useState('');
  const [packaging, setPackaging] = React.useState<string[]>([]);

  const [condition, setCondition] = React.useState('');
  const [material, setMaterial] = React.useState('');
  const [color, setColor] = React.useState('');
  const [size, setSize] = React.useState('');
  const [pattern, setPattern] = React.useState('');
  const [vintage, setVintage] = React.useState(false);

  const [price, setPrice] = React.useState('');
  const [allowOffers, setAllowOffers] = React.useState(false);
  const [shippingMethod, setShippingMethod] = React.useState('baboon');
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | undefined>(undefined);
  const [isAddrDialogOpen, setIsAddrDialogOpen] = React.useState(false);
  const [isAddingNewAddress, setIsAddingNewAddress] = React.useState(false);

  const [seeded, setSeeded] = React.useState(false);

  // ── Seed form from Firestore ──
  React.useEffect(() => {
    if (product && !seeded) {
      setImages((product.images ?? []).filter(img => img?.url?.startsWith('http')));
      setGender(product.gender ?? 'women');
      setSubcategoryId(product.subcategoryId ?? '');
      setCategoryId(product.categoryId ?? '');
      setBrandId(product.brandId ?? '');
      setTitle(product.title ?? '');
      setDescription(product.description ?? '');
      setCondition(product.condition ?? '');
      setSize(product.size ?? '');
      setColor(product.color ?? '');
      setMaterial(product.material ?? '');
      setPattern(product.pattern ?? '');
      setVintage(product.vintage ?? false);
      setPrice(product.price?.toString() ?? '');
      setSelectedAddressId(product.shippingFromAddressId);
      setSeeded(true);
    }
  }, [product, seeded]);

  // ── Auto-select default address ──
  React.useEffect(() => {
    if (!selectedAddressId && addresses && addresses.length > 0) {
      const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses, selectedAddressId]);

  // ── Pricing calculations ──
  const currentPrice = parseFloat(price) || 0;
  const fee = currentPrice * PLATFORM_FEE;
  const earnings = currentPrice - fee;

  const selectedAddress = addresses?.find(a => a.id === selectedAddressId);

  // ── Photo Upload ──
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !user) return;

    setIsUploadingImage(true);
    try {
      const uploaded: ProductImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const idToken = await user.getIdToken();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.uid);
        formData.append('productId', productId);
        formData.append('index', String(images.length + i));

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        uploaded.push({ url: data.url, position: data.position });
      }
      setImages(prev => [...prev, ...uploaded]);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index).map((img, i) => ({ ...img, position: i })));
  };

  // ── Save ──
  const handleSave = async () => {
    if (!productRef || !user) return;
    if (user.uid !== product?.sellerId) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'You can only edit your own listings.' });
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(productRef, {
        images: images.map((img, i) => ({ ...img, position: i })),
        gender,
        subcategoryId,
        categoryId,
        brandId,
        title: title.trim(),
        description: description.trim(),
        condition,
        size: size.trim(),
        color,
        material,
        pattern,
        vintage,
        price: parseFloat(price) || product!.price,
        shippingFromAddressId: selectedAddressId,
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Listing updated', description: 'Your changes have been saved.' });
      router.push(`/products/${productId}`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not save changes.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading / Auth states ──
  if (isProductLoading || isUserLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-muted-foreground">Product not found.</p>
        <Button asChild variant="link" className="mt-4"><Link href="/profile/listings">Back to listings</Link></Button>
      </div>
    );
  }

  if (user?.uid !== product.sellerId) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-muted-foreground">You don&apos;t have permission to edit this listing.</p>
        <Button asChild variant="link" className="mt-4"><Link href="/profile/listings">Back to listings</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 pb-24">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-10">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/products/${productId}`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-headline">Edit Listing</h1>
          <p className="text-sm text-muted-foreground">{product.brandId} — {product.title}</p>
        </div>
      </div>

      <div className="space-y-10">

        {/* ════════════════════════════════════════
            SECTION 1 — Photos
        ════════════════════════════════════════ */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-headline">Photos</h2>
          <p className="text-sm text-muted-foreground">Add or remove photos. The first photo will be your main listing image.</p>

          <div className="grid grid-cols-4 gap-3">
            {images.map((img, index) => (
              <div key={index} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted group">
                <NextImage
                  src={img.url}
                  alt={`Photo ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 25vw, 150px"
                />
                {index === 0 && (
                  <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Main
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {images.length < 8 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="aspect-[3/4] rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {isUploadingImage ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-xs font-medium">Add</span>
                  </>
                )}
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
        </section>

        <Separator />

        {/* ════════════════════════════════════════
            SECTION 2 — Category & Brand
        ════════════════════════════════════════ */}
        <section className="space-y-8">
          <h2 className="text-xl font-bold font-headline">Category &amp; Brand</h2>

          {/* Gender */}
          <div className="space-y-4">
            <Label className="font-semibold text-base">What type of item is this?</Label>
            <RadioGroup
              value={gender}
              onValueChange={setGender}
              className="space-y-3"
            >
              {GENDER_OPTIONS.map(g => (
                <Label
                  key={g.value}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition-all hover:border-primary',
                    gender === g.value ? 'border-primary bg-primary/5' : 'border-muted'
                  )}
                >
                  <RadioGroupItem value={g.value} />
                  <span className="font-semibold">{g.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="font-semibold">Category</Label>
            <Combobox
              value={subcategoryId}
              onValueChange={(val) => {
                setSubcategoryId(val);
                const sub = categories?.find(c => c.slug === val);
                const parent = categories?.find(c => c.id === sub?.parentId);
                if (parent) setCategoryId(parent.name);
              }}
              items={categoryTree}
              placeholder="Select item type"
              searchPlaceholder="Search categories..."
              emptyPlaceholder="No category found."
            />
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Label className="font-semibold">Brand</Label>
            <Combobox
              value={brandId}
              onValueChange={setBrandId}
              items={brands?.map(b => ({ value: b.name, label: b.name })) || []}
              placeholder="Select brand"
              searchPlaceholder="Search brands..."
              emptyPlaceholder="No brands found."
            />
          </div>
        </section>

        <Separator />

        {/* ════════════════════════════════════════
            SECTION 3 — Description
        ════════════════════════════════════════ */}
        <section className="space-y-8">
          <h2 className="text-xl font-bold font-headline">Description</h2>

          {/* Title */}
          <div className="space-y-2">
            <Label className="font-semibold">Title</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Chanel Classic Medium Double Flap Bag"
              className="h-12"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="font-semibold">Description</Label>
            </div>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the item's features, history, and any imperfections."
              className="resize-y min-h-[120px]"
            />
          </div>

          <Separator />

          {/* Origin */}
          <div className="space-y-4">
            <Label className="font-semibold">
              Origin <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Alert variant="default" className="bg-muted/50">
              <Info className="h-4 w-4" />
              <AlertDescription>
                We can&apos;t accept items gifted at VIP or press events, sent complimentary, or offered in-store as part of a purchase.
              </AlertDescription>
            </Alert>
            <RadioGroup
              value={origin}
              onValueChange={setOrigin}
              className="space-y-2"
            >
              {ORIGIN_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-3">
                  <RadioGroupItem value={opt.value} id={`origin-${opt.value}`} />
                  <Label htmlFor={`origin-${opt.value}`} className="font-normal cursor-pointer">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Year of Purchase */}
          <div className="space-y-2">
            <Label className="font-semibold">Year of purchase</Label>
            <Select value={yearOfPurchase} onValueChange={setYearOfPurchase}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Serial Number */}
          <div className="space-y-2">
            <Label className="font-semibold">
              Serial number <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">This information will not be publicly displayed.</p>
            <Input
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value)}
              placeholder="Serial number"
              className="h-12"
            />
          </div>

          {/* Packaging */}
          <div className="space-y-3">
            <Label className="font-semibold">
              Packaging <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            {PACKAGING_ITEMS.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <Checkbox
                  id={`pkg-${item.id}`}
                  checked={packaging.includes(item.id)}
                  onCheckedChange={checked =>
                    setPackaging(prev =>
                      checked ? [...prev, item.id] : prev.filter(p => p !== item.id)
                    )
                  }
                />
                <Label htmlFor={`pkg-${item.id}`} className="font-normal cursor-pointer">{item.label}</Label>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* ════════════════════════════════════════
            SECTION 4 — Item Details
        ════════════════════════════════════════ */}
        <section className="space-y-8">
          <h2 className="text-xl font-bold font-headline">Item Details</h2>

          {/* Condition */}
          <div className="space-y-2">
            <Label className="font-semibold">Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {conditions && conditions.length > 0
                  ? conditions.map(c => <SelectItem key={c.id} value={c.value}>{c.name}</SelectItem>)
                  : ['new_with_tags', 'new_without_tags', 'very_good', 'good', 'fair'].map(v => (
                      <SelectItem key={v} value={v}>
                        {v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          {/* Material + Color */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 flex flex-col">
              <Label className="font-semibold">Material</Label>
              <Combobox
                value={material}
                onValueChange={setMaterial}
                items={materials?.map(m => ({ value: m.value, label: m.name })) || []}
                placeholder="Material"
                searchPlaceholder="Search..."
                emptyPlaceholder="No results."
              />
            </div>
            <div className="space-y-2 flex flex-col">
              <Label className="font-semibold">Color</Label>
              <Combobox
                value={color}
                onValueChange={setColor}
                items={colors?.map(c => ({ value: c.value, label: c.name })) || []}
                placeholder="Color"
                searchPlaceholder="Search..."
                emptyPlaceholder="No results."
              />
            </div>
          </div>

          {/* Size + Pattern */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">Size</Label>
              <Input
                value={size}
                onChange={e => setSize(e.target.value)}
                placeholder="e.g. 42 / M"
                className="h-12"
              />
            </div>
            <div className="space-y-2 flex flex-col">
              <Label className="font-semibold">Pattern</Label>
              <Combobox
                value={pattern}
                onValueChange={setPattern}
                items={patterns?.map(p => ({ value: p.value, label: p.name })) || []}
                placeholder="Pattern"
                searchPlaceholder="Search..."
                emptyPlaceholder="No results."
              />
            </div>
          </div>

          {/* Vintage */}
          <div className="flex flex-row items-center justify-between rounded-xl border p-4">
            <div className="space-y-0.5">
              <p className="text-base font-semibold">Vintage Item</p>
              <p className="text-xs text-muted-foreground">Item is 15+ years old.</p>
            </div>
            <Switch checked={vintage} onCheckedChange={setVintage} />
          </div>
        </section>

        <Separator />

        {/* ════════════════════════════════════════
            SECTION 5 — Pricing & Shipping
        ════════════════════════════════════════ */}
        <section className="space-y-8">
          <h2 className="text-xl font-bold font-headline">Pricing &amp; Shipping</h2>

          {/* Price */}
          <div className="space-y-4">
            <Label className="text-base font-bold">Set your price</Label>
            <div className="relative">
              <Input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="h-20 text-4xl font-bold pl-12"
                placeholder="0"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">€</span>
            </div>
          </div>

          {/* Fee Breakdown */}
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

          {/* Allow Offers */}
          <div className="flex items-center justify-between py-2 border-b pb-4">
            <div className="space-y-0.5">
              <Label className="text-base font-bold">Allow offers</Label>
              <p className="text-sm text-muted-foreground">Let buyers negotiate the price</p>
            </div>
            <Switch checked={allowOffers} onCheckedChange={setAllowOffers} />
          </div>

          {/* Shipping */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2 text-base font-bold">
              <Truck className="h-5 w-5" />
              Shipping details
            </Label>
            <select
              className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm font-medium"
              value={shippingMethod}
              onChange={e => setShippingMethod(e.target.value)}
            >
              <option value="baboon">Baboon Delivery (€5.00 — Recommended)</option>
              <option value="other">Other courier</option>
              <option value="free">Free shipping</option>
            </select>

            {/* Shipping Address */}
            <div className="space-y-3 pt-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Shipping from</Label>
              {selectedAddress ? (
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
                <Button
                  variant="outline"
                  className="w-full h-16 border-dashed border-2 rounded-xl"
                  onClick={() => { setIsAddingNewAddress(true); setIsAddrDialogOpen(true); }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add shipping address
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* ── Save Button ── */}
        <Button
          className="w-full h-14 text-base font-bold rounded-full bg-foreground text-background hover:bg-foreground/90"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save Changes</>
          )}
        </Button>
      </div>

      {/* ── Address Selection Dialog ── */}
      <Dialog open={isAddrDialogOpen} onOpenChange={setIsAddrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAddingNewAddress ? 'Add New Address' : 'Select Shipping Address'}</DialogTitle>
            <DialogDescription>Where will you be shipping this item from?</DialogDescription>
          </DialogHeader>

          {isAddingNewAddress ? (
            <div className="py-4">
              {user && (
                <AddressForm
                  userId={user.uid}
                  onSave={() => { setIsAddingNewAddress(false); setIsAddrDialogOpen(false); }}
                />
              )}
              <Button variant="ghost" className="w-full mt-2" onClick={() => setIsAddingNewAddress(false)}>
                Back to list
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <RadioGroup
                value={selectedAddressId}
                onValueChange={setSelectedAddressId}
                className="grid gap-3"
              >
                {addresses?.map(addr => (
                  <Label
                    key={addr.id}
                    className={cn(
                      'flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all',
                      selectedAddressId === addr.id ? 'border-primary bg-primary/5' : 'border-muted hover:bg-muted/30'
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
              <Button variant="outline" className="w-full" onClick={() => setIsAddingNewAddress(true)}>
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
