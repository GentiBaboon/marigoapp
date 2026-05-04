'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useFirestore, useUser, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import type {
  FirestoreProduct,
  FirestoreUser,
  FirestoreOffer,
  FirestoreConversation,
  FirestoreCategory,
  FirestoreAttribute,
  FirestoreBrand,
  ProductImage,
} from '@/lib/types';
import type { MacroFilter, MacroFiltersConfig } from '@/components/home/MacroFilters';
import { toDate } from '@/lib/types';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Combobox } from '@/components/ui/combobox';
import {
  ArrowLeft,
  Loader2,
  Star,
  Trash2,
  Save,
  ImagePlus,
  X,
  GripVertical,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const PRODUCT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Sold' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'removed', label: 'Removed' },
  { value: 'reserved', label: 'Reserved' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  sold: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  removed: 'bg-red-200 text-red-900',
  reserved: 'bg-purple-100 text-purple-800',
};

const GENDER_OPTIONS = [
  { value: 'women', label: 'Womenswear' },
  { value: 'men', label: 'Menswear' },
  { value: 'children', label: 'Children' },
  { value: 'unisex', label: 'Unisex' },
];

const LISTING_TYPES = [
  { value: 'fixed_price', label: 'Fixed Price' },
  { value: 'auction', label: 'Auction' },
];

interface AdminLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  actionType: string;
  details: string;
  targetId: string;
  timestamp: any;
}

export default function AdminProductReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const firestore = useFirestore();
  const { user: adminUser } = useUser();
  const { toast } = useToast();

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isMacroSaving, setIsMacroSaving] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [conversations, setConversations] = React.useState<FirestoreConversation[]>([]);
  const [adminLogs, setAdminLogs] = React.useState<AdminLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);

  // ── Firestore refs ──
  const productRef = useMemoFirebase(() => (id ? doc(firestore, 'products', id) : null), [firestore, id]);
  const { data: product, isLoading: productLoading } = useDoc<FirestoreProduct>(productRef);

  const sellerRef = useMemoFirebase(() => (product?.sellerId ? doc(firestore, 'users', product.sellerId) : null), [firestore, product?.sellerId]);
  const { data: seller } = useDoc<FirestoreUser>(sellerRef);

  const offersQuery = useMemoFirebase(
    () => (id ? collection(firestore, `products/${id}/offers`) : null),
    [firestore, id]
  );
  const { data: offers } = useCollection<FirestoreOffer>(offersQuery);

  // ── Attribute collections ──
  const categoriesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'categories'), where('isActive', '==', true)) : null),
    [firestore]
  );
  const brandsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'brands') : null), [firestore]);
  const conditionsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'conditions') : null), [firestore]);
  const materialsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'materials') : null), [firestore]);
  const colorsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'colors') : null), [firestore]);
  const patternsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'patterns') : null), [firestore]);

  const { data: categories } = useCollection<FirestoreCategory>(categoriesQuery);
  const { data: brands } = useCollection<FirestoreBrand>(brandsQuery);
  const { data: conditions } = useCollection<FirestoreAttribute>(conditionsQuery);
  const { data: materials } = useCollection<FirestoreAttribute>(materialsQuery);
  const { data: colors } = useCollection<FirestoreAttribute>(colorsQuery);
  const { data: patterns } = useCollection<FirestoreAttribute>(patternsQuery);

  const macroFiltersRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'macro_filters') : null),
    [firestore]
  );
  const { data: macroFiltersConfig } = useDoc<MacroFiltersConfig>(macroFiltersRef);

  // ── Category tree for combobox ──
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

  // ── Form state ──
  const [images, setImages] = React.useState<ProductImage[]>([]);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [gender, setGender] = React.useState('women');
  const [subcategoryId, setSubcategoryId] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [brandId, setBrandId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [condition, setCondition] = React.useState('');
  const [material, setMaterial] = React.useState('');
  const [color, setColor] = React.useState('');
  const [size, setSize] = React.useState('');
  const [pattern, setPattern] = React.useState('');
  const [vintage, setVintage] = React.useState(false);
  const [price, setPrice] = React.useState('');
  const [originalPrice, setOriginalPrice] = React.useState('');
  // Inventory — defaults to 1 for legacy products with no field set.
  const [quantity, setQuantity] = React.useState('1');
  const [listingType, setListingType] = React.useState<'fixed_price' | 'auction'>('fixed_price');

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
      setOriginalPrice(product.originalPrice?.toString() ?? '');
      setQuantity(((product as any).quantity ?? 1).toString());
      setListingType(product.listingType ?? 'fixed_price');
      setSeeded(true);
    }
  }, [product, seeded]);

  // ── Fetch conversations ──
  React.useEffect(() => {
    if (!id) return;
    getDocs(query(collection(firestore, 'conversations'), where('productId', '==', id)))
      .then(snap => setConversations(snap.docs.map(d => ({ ...d.data(), id: d.id } as FirestoreConversation))))
      .catch(err => console.error('Error fetching conversations:', err));
  }, [id, firestore]);

  // ── Fetch admin logs ──
  React.useEffect(() => {
    if (!id) return;
    setLogsLoading(true);
    getDocs(query(collection(firestore, 'admin_logs'), where('targetId', '==', id), orderBy('timestamp', 'desc'), limit(20)))
      .then(snap => setAdminLogs(snap.docs.map(d => ({ ...d.data(), id: d.id } as AdminLogEntry))))
      .catch(err => console.error('Error fetching admin logs:', err))
      .finally(() => setLogsLoading(false));
  }, [id, firestore]);

  const logAction = async (actionType: string, details: string) => {
    if (!adminUser) return;
    await addDoc(collection(firestore, 'admin_logs'), {
      adminId: adminUser.uid,
      adminName: adminUser.displayName || 'Admin',
      actionType,
      details,
      targetId: id,
      timestamp: serverTimestamp(),
    });
  };

  // ── Image drag-and-drop reorder ──
  const dragIndexRef = React.useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDrop = (dropIndex: number) => {
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) return;
    setImages(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next.map((img, i) => ({ ...img, position: i }));
    });
    dragIndexRef.current = null;
  };

  // ── Image upload ──
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !adminUser || !product) return;

    setIsUploadingImage(true);
    try {
      const idToken = await adminUser.getIdToken();
      const uploaded: ProductImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sellerId', product.sellerId);
        formData.append('productId', id);
        formData.append('index', String(images.length + i));

        const res = await fetch('/api/admin/product-upload', {
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

  // ── MacroFilter toggle ──
  const handleMacroFilterToggle = async (filterId: string, currentlyOn: boolean) => {
    if (!macroFiltersRef || !macroFiltersConfig) return;
    setIsMacroSaving(true);
    try {
      const updatedFilters = macroFiltersConfig.filters.map((f: MacroFilter) => {
        if (f.id !== filterId) return f;
        const productIds = currentlyOn
          ? f.productIds.filter((pid: string) => pid !== id)
          : [...f.productIds, id];
        return { ...f, productIds };
      });
      await updateDoc(macroFiltersRef, { filters: updatedFilters });
      await logAction(
        'macrofilter_updated',
        `${currentlyOn ? 'Removed from' : 'Added to'} macrofilter "${filterId}"`
      );
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update macrofilter.' });
    } finally {
      setIsMacroSaving(false);
    }
  };

  // ── Save all edits ──
  const handleSave = async () => {
    if (!productRef || !adminUser || !product) return;
    setIsSaving(true);
    try {
      const parsedPrice = parseFloat(price) || product.price;
      const parsedOriginalPrice = originalPrice ? parseFloat(originalPrice) : null;
      const parsedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

      const updates: Record<string, any> = {
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
        price: parsedPrice,
        quantity: parsedQuantity,
        listingType,
        updatedAt: serverTimestamp(),
      };
      if (parsedOriginalPrice !== null) updates.originalPrice = parsedOriginalPrice;

      await updateDoc(productRef, updates);
      await logAction('product_edited', `Admin edited product "${title.trim()}"`);
      toast({ title: 'Saved', description: 'Product updated successfully.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not save changes.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Status / featured / delete ──
  const handleStatusChange = async (newStatus: string) => {
    if (!firestore || !adminUser || !product) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(firestore, 'products', id), { status: newStatus });
      await logAction('product_status_changed', `Changed "${product.title}" status to "${newStatus}"`);
      toast({ title: 'Status Updated', description: `Product is now "${newStatus}".` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update product status.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleFeatured = async () => {
    if (!firestore || !adminUser || !product) return;
    setIsUpdating(true);
    try {
      const newFeatured = !product.isFeatured;
      await updateDoc(doc(firestore, 'products', id), { isFeatured: newFeatured });
      await logAction('product_featured', `${newFeatured ? 'Featured' : 'Unfeatured'} "${product.title}"`);
      toast({ title: newFeatured ? 'Product Featured' : 'Product Unfeatured' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update product.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !adminUser || !product) return;
    setIsUpdating(true);
    try {
      await deleteDoc(doc(firestore, 'products', id));
      await logAction('product_deleted', `Deleted product "${product.title}"`);
      toast({ title: 'Product Deleted' });
      router.push('/admin/products');
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete product.' });
    } finally {
      setIsUpdating(false);
    }
  };

  if (productLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Product not found.</p>
        <Button variant="ghost" className="mt-4" asChild>
          <Link href="/admin/products"><ArrowLeft className="mr-2 h-4 w-4" />Back to Products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/products"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{product.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={STATUS_COLORS[product.status] || ''}>{product.status}</Badge>
              {product.isFeatured && <Badge className="bg-yellow-100 text-yellow-800">Featured</Badge>}
              {product.isAuthenticated && <Badge className="bg-emerald-100 text-emerald-800">Authenticated</Badge>}
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="shrink-0">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      {/* ══ Images ══ */}
      <Card>
        <CardHeader><CardTitle>Images</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Drag to reorder. First image is the main listing photo.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {images.map((img, index) => (
              <div
                key={index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                className="relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-grab active:cursor-grabbing border-2 border-transparent hover:border-primary/30 transition-colors"
              >
                <Image
                  src={img.url}
                  alt={`Image ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 150px"
                />
                {index === 0 && (
                  <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    Main
                  </span>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-60 transition-opacity">
                  <GripVertical className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            ))}

            {images.length < 10 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Add</span>
                  </>
                )}
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ══ Category & Brand ══ */}
        <Card>
          <CardHeader><CardTitle>Category &amp; Brand</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {/* Gender */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Gender</Label>
              <RadioGroup value={gender} onValueChange={setGender} className="grid grid-cols-2 gap-2">
                {GENDER_OPTIONS.map(g => (
                  <Label
                    key={g.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-all hover:border-primary',
                      gender === g.value ? 'border-primary bg-primary/5 font-semibold' : 'border-muted'
                    )}
                  >
                    <RadioGroupItem value={g.value} />
                    {g.label}
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Category</Label>
              <Combobox
                value={subcategoryId}
                onValueChange={val => {
                  setSubcategoryId(val);
                  const sub = categories?.find(c => c.slug === val);
                  const parent = categories?.find(c => c.id === sub?.parentId);
                  if (parent) setCategoryId(parent.name);
                }}
                items={categoryTree}
                placeholder="Select category"
                searchPlaceholder="Search categories..."
                emptyPlaceholder="No category found."
              />
            </div>

            {/* Brand */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Brand</Label>
              <Combobox
                value={brandId}
                onValueChange={setBrandId}
                items={brands?.map(b => ({ value: b.name, label: b.name })) || []}
                placeholder="Select brand"
                searchPlaceholder="Search brands..."
                emptyPlaceholder="No brands found."
              />
            </div>
          </CardContent>
        </Card>

        {/* ══ Description ══ */}
        <Card>
          <CardHeader><CardTitle>Description</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Product title" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the item..."
                className="resize-y min-h-[120px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* ══ Item Details ══ */}
        <Card>
          <CardHeader><CardTitle>Item Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Condition */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Material</Label>
                <Combobox
                  value={material}
                  onValueChange={setMaterial}
                  items={materials?.map(m => ({ value: m.value, label: m.name })) || []}
                  placeholder="Material"
                  searchPlaceholder="Search..."
                  emptyPlaceholder="No results."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Color</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Size</Label>
                <Input value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. 42 / M" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Pattern</Label>
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
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-semibold">Vintage Item</p>
                <p className="text-xs text-muted-foreground">15+ years old</p>
              </div>
              <Switch checked={vintage} onCheckedChange={setVintage} />
            </div>
          </CardContent>
        </Card>

        {/* ══ Pricing ══ */}
        <Card>
          <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Listing Type</Label>
              <Select value={listingType} onValueChange={v => setListingType(v as 'fixed_price' | 'auction')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LISTING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Price (EUR)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">€</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Original Price (EUR)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={originalPrice}
                    onChange={e => setOriginalPrice(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">€</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Quantity (Inventory)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                onBlur={() => setQuantity(String(Math.max(1, Math.floor(Number(quantity) || 1))))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Available stock for this listing. Set to 1 for unique items.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 text-sm text-muted-foreground">
              <span>{product.views} views</span>
              <span>·</span>
              <span>{product.wishlistCount} wishlisted</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══ MacroFilters ══ */}
      <Card>
        <CardHeader>
          <CardTitle>MacroFilters</CardTitle>
          <p className="text-sm text-muted-foreground">Toggle which homepage filters include this product.</p>
        </CardHeader>
        <CardContent>
          {!macroFiltersConfig?.filters?.length ? (
            <p className="text-sm text-muted-foreground">No macrofilters configured yet. Set them up in Admin → Settings.</p>
          ) : (
            <div className="divide-y">
              {macroFiltersConfig.filters.map((f: MacroFilter) => {
                const isOn = f.productIds.includes(id);
                return (
                  <div key={f.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{f.label}</span>
                      {!f.enabled && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">disabled on homepage</Badge>
                      )}
                    </div>
                    <Switch
                      checked={isOn}
                      disabled={isMacroSaving}
                      onCheckedChange={() => handleMacroFilterToggle(f.id, isOn)}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {isMacroSaving && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ Admin Actions ══ */}
      <Card>
        <CardHeader><CardTitle>Admin Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</Label>
              <Select value={product.status} onValueChange={handleStatusChange} disabled={isUpdating}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Featured</Label>
              <div>
                <Button variant="outline" onClick={handleToggleFeatured} disabled={isUpdating}>
                  <Star className={cn('mr-2 h-4 w-4', product.isFeatured ? 'fill-yellow-400 text-yellow-400' : '')} />
                  {product.isFeatured ? 'Unfeature' : 'Feature'}
                </Button>
              </div>
            </div>

            <div className="space-y-1 ml-auto">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Danger Zone</Label>
              <div>
                <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={isUpdating}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Product
                </Button>
              </div>
            </div>

            {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </CardContent>
      </Card>

      {/* ══ Seller ══ */}
      <Card>
        <CardHeader><CardTitle>Seller</CardTitle></CardHeader>
        <CardContent>
          {seller ? (
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                {seller.profileImage ? (
                  <Image src={seller.profileImage} alt={seller.name || 'Seller'} fill className="object-cover" sizes="40px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-medium">
                    {(seller.name || '?')[0]}
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium">{seller.name}</p>
                <p className="text-sm text-muted-foreground">{seller.email}</p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">{seller.role}</Badge>
                {seller.isVerifiedSeller && <Badge className="bg-emerald-100 text-emerald-800">Verified</Badge>}
                {seller.kycStatus && <Badge variant="outline">KYC: {seller.kycStatus}</Badge>}
              </div>
            </div>
          ) : (
            <Skeleton className="h-12" />
          )}
        </CardContent>
      </Card>

      {/* ══ Authenticity Check ══ */}
      {product.authenticityCheck && (
        <Card>
          <CardHeader><CardTitle>Authenticity Check</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="capitalize">{product.authenticityCheck.status}</Badge>
              <Badge variant="outline">Confidence: {product.authenticityCheck.confidence}</Badge>
            </div>
            {product.authenticityCheck.findings && product.authenticityCheck.findings.length > 0 && (
              <ul className="list-disc list-inside text-sm space-y-1">
                {product.authenticityCheck.findings.map((finding, idx) => (
                  <li key={idx}>{finding}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* ══ Offers ══ */}
      <Card>
        <CardHeader><CardTitle>Offers ({offers?.length || 0})</CardTitle></CardHeader>
        <CardContent>
          {offers && offers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map(offer => {
                  const offerDate = toDate(offer.createdAt);
                  return (
                    <TableRow key={offer.id}>
                      <TableCell className="font-medium">{offer.buyerName}</TableCell>
                      <TableCell>{offer.amount?.toFixed(2) || '0.00'} EUR</TableCell>
                      <TableCell className="max-w-[200px] truncate">{offer.message || '-'}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{offer.status}</Badge></TableCell>
                      <TableCell>{offerDate ? format(offerDate, 'd MMM yyyy') : 'N/A'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No offers received.</p>
          )}
        </CardContent>
      </Card>

      {/* ══ Conversations ══ */}
      <Card>
        <CardHeader><CardTitle>Conversations ({conversations.length})</CardTitle></CardHeader>
        <CardContent>
          {conversations.length > 0 ? (
            <div className="space-y-3">
              {conversations.map(conv => {
                const lastMsgDate = toDate(conv.lastMessageAt);
                const participantNames = conv.participantDetails?.map(p => p.name).join(', ') || 'Unknown';
                return (
                  <div key={conv.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{participantNames}</p>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    </div>
                    <span className="text-xs text-muted-foreground ml-4 shrink-0">
                      {lastMsgDate ? format(lastMsgDate, 'd MMM yyyy') : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No conversations found.</p>
          )}
        </CardContent>
      </Card>

      {/* ══ Activity Log ══ */}
      <Card>
        <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : adminLogs.length > 0 ? (
            <div className="space-y-3">
              {adminLogs.map(log => {
                const logDate = toDate(log.timestamp);
                return (
                  <div key={log.id} className="flex items-start gap-3 border-l-2 border-muted pl-4 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{log.adminName}</span>
                        <Badge variant="outline" className="text-[10px]">{log.actionType}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{log.details}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {logDate ? format(logDate, 'd MMM yyyy, HH:mm') : 'N/A'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No activity logged yet.</p>
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete Product"
        description={`Are you sure you want to permanently delete "${product.title}"? This action cannot be undone.`}
        actionLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isUpdating}
      />
    </div>
  );
}
