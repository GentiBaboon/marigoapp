'use client';

import * as React from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Edit, Trash2, Loader2, Eye, EyeOff,
  MoveUp, MoveDown, Image as ImageIcon, Save,
  Upload, X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';
import { cn } from '@/lib/utils';
import type { HomepageBlock, HomepageBlocksConfig, BlockImage } from '@/components/home/HomepageBlocks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
    img.src = objectUrl;
  });
}

const emptyBlock = (): HomepageBlock => ({
  id: `block-${Date.now()}`,
  images: [],
  title: '',
  subtitle: '',
  url: '',
  visible: false,
  order: 0,
});

// ─── ImageSlot ────────────────────────────────────────────────────────────────

function ImageSlot({
  image,
  onChange,
  onRemove,
}: {
  image: BlockImage | null;
  onChange: (img: BlockImage) => void;
  onRemove: () => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Please select an image file.' });
      return;
    }
    setUploading(true);
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const idToken = await currentUser.getIdToken();
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append('file', compressed, 'image.jpg');

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      const { url } = await res.json();
      onChange({ url, x: 50, y: 50 });
      toast({ title: 'Image uploaded.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: e.message || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  // Drag the dot to reposition; clicking also sets focal point
  const startDotDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = previewRef.current;
    if (!container || !image) return;

    const onMove = (me: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = Math.round(Math.max(0, Math.min(100, ((me.clientX - rect.left) / rect.width) * 100)));
      const y = Math.round(Math.max(0, Math.min(100, ((me.clientY - rect.top) / rect.height) * 100)));
      onChange({ ...image, x, y });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewRef.current || !image) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onChange({ ...image, x, y });
  };

  // ── Uploaded preview ──
  if (image?.url) {
    return (
      <div className="space-y-1">
        <div
          ref={previewRef}
          onClick={handleContainerClick}
          className="relative h-36 rounded-lg overflow-hidden select-none cursor-crosshair"
        >
          <Image
            src={image.url}
            alt="Block image"
            fill
            className="object-cover pointer-events-none"
            style={{ objectPosition: `${image.x}% ${image.y}%` }}
            sizes="300px"
          />

          {/* Crosshair lines */}
          <div
            className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none"
            style={{ left: `${image.x}%` }}
          />
          <div
            className="absolute left-0 right-0 h-px bg-white/30 pointer-events-none"
            style={{ top: `${image.y}%` }}
          />

          {/* Draggable focal point dot */}
          <div
            className="absolute w-5 h-5 rounded-full border-2 border-white bg-primary shadow-lg -translate-x-1/2 -translate-y-1/2 cursor-move z-10"
            style={{ left: `${image.x}%`, top: `${image.y}%` }}
            onMouseDown={startDotDrag}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Hint */}
          <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
            <span className="text-white text-[11px] bg-black/60 px-2 py-0.5 rounded-full">
              Drag dot or click to reposition
            </span>
          </div>
        </div>

        {/* Remove button */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive"
            onClick={onRemove}
          >
            <X className="h-3 w-3 mr-1" /> Remove
          </Button>
        </div>
      </div>
    );
  }

  // ── Upload zone ──
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) upload(f);
      }}
      className={cn(
        'relative h-36 w-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors',
        dragOver
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = '';
        }}
      />
      {uploading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center px-2">
            <span className="font-medium text-foreground">Click to upload</span> or drag & drop
          </p>
          <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP</p>
        </>
      )}
    </div>
  );
}

// ─── HomepageBlocksTab ────────────────────────────────────────────────────────

export function HomepageBlocksTab() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [blocks, setBlocks] = React.useState<HomepageBlock[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState<HomepageBlock>(emptyBlock());

  const blocksRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'homepage_blocks') : null),
    [firestore],
  );
  const { data } = useDoc<HomepageBlocksConfig>(blocksRef);

  React.useEffect(() => {
    if (data?.blocks) setBlocks(data.blocks.sort((a, b) => a.order - b.order));
  }, [data]);

  const openCreate = () => {
    setEditingIndex(null);
    setFormData({ ...emptyBlock(), order: blocks.length });
    setDialogOpen(true);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setFormData({ ...blocks[index] });
    setDialogOpen(true);
  };

  const handleSaveItem = () => {
    const updated = [...blocks];
    if (editingIndex !== null) {
      updated[editingIndex] = formData;
    } else {
      updated.push(formData);
    }
    setBlocks(updated.map((b, i) => ({ ...b, order: i })));
    setDialogOpen(false);
  };

  const handleRemove = (index: number) =>
    setBlocks((prev) => prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i })));

  const toggleVisibility = (index: number) =>
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, visible: !b.visible } : b)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const updated = [...blocks];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setBlocks(updated.map((b, i) => ({ ...b, order: i })));
  };

  const handlePublish = async () => {
    if (!firestore) return;
    setIsLoading(true);
    try {
      await setDoc(doc(firestore, 'settings', 'homepage_blocks'), { blocks });
      toast({ title: 'Homepage blocks saved.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error saving blocks.' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Image slot helpers ──
  const images: BlockImage[] = formData.images ?? [];

  const setImage = (idx: number, img: BlockImage) =>
    setFormData((p) => {
      const arr = [...(p.images ?? [])];
      arr[idx] = img;
      return { ...p, images: arr };
    });

  const removeImage = (idx: number) =>
    setFormData((p) => ({ ...p, images: (p.images ?? []).filter((_, i) => i !== idx) }));

  const addImageSlot = () => {
    if (images.length >= 3) return;
    setFormData((p) => ({
      ...p,
      images: [...(p.images ?? []), { url: '', x: 50, y: 50 }],
    }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Homepage Blocks</CardTitle>
            <CardDescription>Configurable image blocks shown on the homepage.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Block
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" /> Publish
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {blocks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">
              No blocks yet. Add your first homepage block.
            </p>
          ) : (
            <div className="space-y-3">
              {blocks.map((block, index) => {
                const firstImage =
                  block.images?.find((i) => i.url) ??
                  (block.imageUrl ? { url: block.imageUrl, x: 50, y: 50 } : null);
                const imgCount = block.images?.filter((i) => i.url).length ?? (block.imageUrl ? 1 : 0);
                return (
                  <div key={block.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                    <div className="relative h-16 w-24 shrink-0 rounded-md overflow-hidden bg-muted">
                      {firstImage ? (
                        <Image
                          src={firstImage.url}
                          alt={block.title ?? ''}
                          fill
                          className="object-cover"
                          style={{ objectPosition: `${firstImage.x}% ${firstImage.y}%` }}
                          sizes="96px"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {block.title || block.text || 'Untitled block'}
                      </p>
                      {block.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{block.subtitle}</p>
                      )}
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground truncate">{block.url || 'No URL'}</p>
                        {imgCount > 1 && (
                          <Badge variant="outline" className="text-[10px] py-0">{imgCount} images</Badge>
                        )}
                        {!block.visible && (
                          <Badge variant="secondary" className="text-[10px] py-0">Hidden</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(index, -1)} disabled={index === 0}>
                        <MoveUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(index, 1)} disabled={index === blocks.length - 1}>
                        <MoveDown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleVisibility(index)}>
                        {block.visible
                          ? <Eye className="h-3 w-3" />
                          : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(index)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemove(index)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? 'Edit Block' : 'New Block'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Images */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Images{' '}
                  <span className="font-normal text-muted-foreground text-xs">(1–3 per block)</span>
                </Label>
                {images.length < 3 && (
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addImageSlot}>
                    <Plus className="h-3 w-3 mr-1" /> Add Image
                  </Button>
                )}
              </div>

              {images.length === 0 ? (
                // Empty state — clicking adds the first slot
                <button
                  type="button"
                  onClick={addImageSlot}
                  className="h-36 w-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <ImageIcon className="h-7 w-7" />
                  <p className="text-xs">Click to add first image</p>
                </button>
              ) : (
                <div className={cn('grid gap-2', images.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                  {images.map((img, idx) => (
                    <ImageSlot
                      key={idx}
                      image={img.url ? img : null}
                      onChange={(updated) => setImage(idx, updated)}
                      onRemove={() => removeImage(idx)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title ?? ''}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Sara Hoxha Store"
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input
                value={formData.subtitle ?? ''}
                onChange={(e) => setFormData((p) => ({ ...p, subtitle: e.target.value }))}
                placeholder="e.g. New arrivals every week"
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData((p) => ({ ...p, url: e.target.value }))}
                placeholder="/browse/women"
              />
            </div>

            {/* Visible */}
            <div className="flex items-center justify-between">
              <Label>Visible on Homepage</Label>
              <Switch
                checked={formData.visible}
                onCheckedChange={(val) => setFormData((p) => ({ ...p, visible: val }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveItem}>Save Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
