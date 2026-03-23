'use client';

import * as React from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Loader2, GripVertical, Image as ImageIcon, Eye, EyeOff, MoveUp, MoveDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  isVisible: boolean;
  position: number;
  animation: 'none' | 'fade-in' | 'slide-up' | 'slide-left' | 'zoom-in' | 'parallax';
  overlay: 'none' | 'dark' | 'gradient' | 'light';
  textAlign: 'left' | 'center' | 'right';
  height: 'small' | 'medium' | 'large' | 'full';
}

interface BannerConfig {
  banners: Banner[];
}

const ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade-in', label: 'Fade In' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'parallax', label: 'Parallax' },
];

const OVERLAYS = [
  { value: 'none', label: 'None' },
  { value: 'dark', label: 'Dark Overlay' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'light', label: 'Light Overlay' },
];

const HEIGHTS = [
  { value: 'small', label: 'Small (200px)' },
  { value: 'medium', label: 'Medium (350px)' },
  { value: 'large', label: 'Large (500px)' },
  { value: 'full', label: 'Full Screen' },
];

const emptyBanner: Banner = {
  id: '',
  title: '',
  subtitle: '',
  imageUrl: '',
  linkUrl: '',
  linkLabel: 'Shop Now',
  isVisible: true,
  position: 0,
  animation: 'fade-in',
  overlay: 'dark',
  textAlign: 'center',
  height: 'large',
};

export function BannerConfigTab() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const bannerRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'banners') : null, [firestore]);
  const { data: bannerData } = useDoc<BannerConfig>(bannerRef);

  const [banners, setBanners] = React.useState<Banner[]>([]);
  const [formData, setFormData] = React.useState<Banner>(emptyBanner);

  React.useEffect(() => {
    if (bannerData?.banners) {
      setBanners(bannerData.banners.sort((a, b) => a.position - b.position));
    }
  }, [bannerData]);

  const openCreate = () => {
    setEditingIndex(null);
    setFormData({ ...emptyBanner, id: `banner-${Date.now()}`, position: banners.length });
    setDialogOpen(true);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setFormData({ ...banners[index] });
    setDialogOpen(true);
  };

  const handleSaveItem = () => {
    if (!formData.title.trim() && !formData.imageUrl.trim()) {
      toast({ variant: 'destructive', title: 'Title or image required.' });
      return;
    }
    const updated = [...banners];
    if (editingIndex !== null) {
      updated[editingIndex] = formData;
    } else {
      updated.push(formData);
    }
    setBanners(updated);
    setDialogOpen(false);
  };

  const handleRemoveBanner = (index: number) => {
    setBanners(prev => prev.filter((_, i) => i !== index));
  };

  const toggleVisibility = (index: number) => {
    const updated = [...banners];
    updated[index] = { ...updated[index], isVisible: !updated[index].isVisible };
    setBanners(updated);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...banners];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setBanners(updated.map((b, i) => ({ ...b, position: i })));
  };

  const moveDown = (index: number) => {
    if (index === banners.length - 1) return;
    const updated = [...banners];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setBanners(updated.map((b, i) => ({ ...b, position: i })));
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...banners];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setBanners(updated.map((b, i) => ({ ...b, position: i })));
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  const handlePublish = async () => {
    setIsLoading(true);
    try {
      const reordered = banners.map((b, i) => ({ ...b, position: i }));
      await setDoc(doc(firestore, 'settings', 'banners'), { banners: reordered });
      toast({ title: 'Banners published!' });
    } catch {
      toast({ variant: 'destructive', title: 'Error saving banners.' });
    } finally {
      setIsLoading(false);
    }
  };

  const heightPx: Record<string, string> = { small: '200px', medium: '350px', large: '500px', full: '100vh' };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Home Banners</CardTitle>
            <CardDescription>Drag and drop to reorder. Configure animations, overlays, and positioning.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Banner</Button>
            <Button size="sm" onClick={handlePublish} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {banners.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">No banners yet. Create your first banner for the home page.</p>
          ) : (
            <div className="space-y-3">
              {banners.map((banner, index) => (
                <div
                  key={banner.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                    dragIndex === index ? 'opacity-50 border-primary' : 'bg-background'
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />

                  {/* Thumbnail */}
                  <div className="relative h-16 w-28 shrink-0 rounded-md overflow-hidden bg-muted">
                    {banner.imageUrl ? (
                      <Image src={banner.imageUrl} alt={banner.title} fill className="object-cover" sizes="112px" />
                    ) : (
                      <div className="flex items-center justify-center h-full"><ImageIcon className="h-6 w-6 text-muted-foreground/40" /></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{banner.title || 'Untitled'}</span>
                      {!banner.isVisible && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{banner.animation}</Badge>
                      <Badge variant="outline" className="text-[10px]">{banner.overlay}</Badge>
                      <Badge variant="outline" className="text-[10px]">{banner.height}</Badge>
                      <Badge variant="outline" className="text-[10px]">align: {banner.textAlign}</Badge>
                    </div>
                  </div>

                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveUp(index)} disabled={index === 0}><MoveUp className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveDown(index)} disabled={index === banners.length - 1}><MoveDown className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleVisibility(index)}>
                      {banner.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(index)}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveBanner(index)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? 'Edit Banner' : 'New Banner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Preview */}
            {formData.imageUrl && (
              <div className="relative rounded-lg overflow-hidden" style={{ height: '180px' }}>
                <Image src={formData.imageUrl} alt="Preview" fill className="object-cover" sizes="600px" />
                <div className={`absolute inset-0 flex flex-col justify-center px-8 ${
                  formData.overlay === 'dark' ? 'bg-black/50' :
                  formData.overlay === 'gradient' ? 'bg-gradient-to-r from-black/70 to-transparent' :
                  formData.overlay === 'light' ? 'bg-white/40' : ''
                } ${
                  formData.textAlign === 'center' ? 'items-center text-center' :
                  formData.textAlign === 'right' ? 'items-end text-right' : 'items-start'
                }`}>
                  <h3 className="text-white font-bold text-xl">{formData.title || 'Banner Title'}</h3>
                  <p className="text-white/80 text-sm mt-1">{formData.subtitle || 'Subtitle text'}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Summer Collection" />
              </div>
              <div className="space-y-2">
                <Label>Subtitle</Label>
                <Input value={formData.subtitle} onChange={e => setFormData(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Up to 50% off" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={formData.imageUrl} onChange={e => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))} placeholder="https://..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Link URL</Label>
                <Input value={formData.linkUrl} onChange={e => setFormData(prev => ({ ...prev, linkUrl: e.target.value }))} placeholder="/search?sale=true" />
              </div>
              <div className="space-y-2">
                <Label>Button Label</Label>
                <Input value={formData.linkLabel} onChange={e => setFormData(prev => ({ ...prev, linkLabel: e.target.value }))} placeholder="Shop Now" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Animation</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md text-sm"
                  value={formData.animation}
                  onChange={e => setFormData(prev => ({ ...prev, animation: e.target.value as Banner['animation'] }))}
                >
                  {ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Overlay</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md text-sm"
                  value={formData.overlay}
                  onChange={e => setFormData(prev => ({ ...prev, overlay: e.target.value as Banner['overlay'] }))}
                >
                  {OVERLAYS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Text Alignment</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md text-sm"
                  value={formData.textAlign}
                  onChange={e => setFormData(prev => ({ ...prev, textAlign: e.target.value as Banner['textAlign'] }))}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Height</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md text-sm"
                  value={formData.height}
                  onChange={e => setFormData(prev => ({ ...prev, height: e.target.value as Banner['height'] }))}
                >
                  {HEIGHTS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Visible on Home Page</Label>
              <Switch checked={formData.isVisible} onCheckedChange={val => setFormData(prev => ({ ...prev, isVisible: val }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveItem}>Save Banner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
