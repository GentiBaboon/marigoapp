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
import type { FirestoreProduct, FirestoreUser, FirestoreOffer, FirestoreConversation } from '@/lib/types';
import { toDate } from '@/lib/types';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Star, Trash2 } from 'lucide-react';
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [conversations, setConversations] = React.useState<FirestoreConversation[]>([]);
  const [adminLogs, setAdminLogs] = React.useState<AdminLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);

  const productRef = useMemoFirebase(() => (id ? doc(firestore, 'products', id) : null), [firestore, id]);
  const { data: product, isLoading: productLoading } = useDoc<FirestoreProduct>(productRef);

  const sellerRef = useMemoFirebase(() => (product?.sellerId ? doc(firestore, 'users', product.sellerId) : null), [firestore, product?.sellerId]);
  const { data: seller } = useDoc<FirestoreUser>(sellerRef);

  const offersQuery = useMemoFirebase(
    () => (id ? collection(firestore, `products/${id}/offers`) : null),
    [firestore, id]
  );
  const { data: offers } = useCollection<FirestoreOffer>(offersQuery);

  // Fetch conversations
  React.useEffect(() => {
    if (!id) return;
    const fetchConvs = async () => {
      try {
        const snap = await getDocs(query(collection(firestore, 'conversations'), where('productId', '==', id)));
        setConversations(snap.docs.map((d) => ({ ...d.data(), id: d.id } as FirestoreConversation)));
      } catch (err) {
        console.error('Error fetching conversations:', err);
      }
    };
    fetchConvs();
  }, [id, firestore]);

  // Fetch admin logs
  React.useEffect(() => {
    if (!id) return;
    setLogsLoading(true);
    const fetchLogs = async () => {
      try {
        const snap = await getDocs(
          query(collection(firestore, 'admin_logs'), where('targetId', '==', id), orderBy('timestamp', 'desc'), limit(20))
        );
        setAdminLogs(snap.docs.map((d) => ({ ...d.data(), id: d.id } as AdminLogEntry)));
      } catch (err) {
        console.error('Error fetching admin logs:', err);
      } finally {
        setLogsLoading(false);
      }
    };
    fetchLogs();
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

  const handleStatusChange = async (newStatus: string) => {
    if (!firestore || !adminUser || !product) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(firestore, 'products', id), { status: newStatus });
      await logAction('product_status_changed', `Changed "${product.title}" status to "${newStatus}"`);
      toast({ title: 'Status Updated', description: `"${product.title}" is now "${newStatus}".` });
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/products"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold truncate">{product.title}</h1>
      </div>

      {/* Image Gallery */}
      {product.images && product.images.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Images</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {product.images
                .sort((a, b) => a.position - b.position)
                .map((img, idx) => (
                  <div key={idx} className="relative aspect-square overflow-hidden rounded-lg">
                    <Image src={img.url} alt={`${product.title} ${idx + 1}`} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Product Info */}
        <Card>
          <CardHeader><CardTitle>Product Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <div className="prose prose-sm max-w-none mt-1">
                <p>{product.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Brand</span>
                <p className="font-medium">{product.brandId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Category</span>
                <p className="font-medium">{product.categoryId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Subcategory</span>
                <p className="font-medium">{product.subcategoryId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Condition</span>
                <p className="font-medium">{product.condition}</p>
              </div>
              {product.size && (
                <div>
                  <span className="text-muted-foreground">Size</span>
                  <p className="font-medium">{product.size}</p>
                </div>
              )}
              {product.color && (
                <div>
                  <span className="text-muted-foreground">Color</span>
                  <p className="font-medium">{product.color}</p>
                </div>
              )}
              {product.material && (
                <div>
                  <span className="text-muted-foreground">Material</span>
                  <p className="font-medium">{product.material}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Gender</span>
                <p className="font-medium capitalize">{product.gender}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 pt-2 border-t">
              <div>
                <span className="text-sm text-muted-foreground">Price</span>
                <p className="text-lg font-bold">{product.price?.toFixed(2) || '0.00'} EUR</p>
              </div>
              {product.originalPrice != null && (
                <div>
                  <span className="text-sm text-muted-foreground">Original</span>
                  <p className="text-lg line-through text-muted-foreground">{product.originalPrice?.toFixed(2) || '0.00'} EUR</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Listing:</span>
              <span className="capitalize">{product.listingType.replace('_', ' ')}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge className={STATUS_COLORS[product.status] || ''}>{product.status}</Badge>
              <Badge variant="outline">{product.views} views</Badge>
              <Badge variant="outline">{product.wishlistCount} wishlisted</Badge>
              {product.isFeatured && <Badge className="bg-yellow-100 text-yellow-800">Featured</Badge>}
              {product.isAuthenticated && <Badge className="bg-emerald-100 text-emerald-800">Authenticated</Badge>}
              {product.vintage && <Badge variant="outline">Vintage</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* Seller Card */}
        <Card>
          <CardHeader><CardTitle>Seller</CardTitle></CardHeader>
          <CardContent>
            {seller ? (
              <div className="space-y-4">
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
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">{seller.role}</Badge>
                  <Badge variant="outline">{seller.rating?.toFixed(1) || '0'} ({seller.reviewCount} reviews)</Badge>
                  {seller.isVerifiedSeller && <Badge className="bg-emerald-100 text-emerald-800">Verified Seller</Badge>}
                  {seller.kycStatus && <Badge variant="outline">KYC: {seller.kycStatus}</Badge>}
                </div>
              </div>
            ) : (
              <Skeleton className="h-16" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Authenticity Check */}
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

      {/* Offers */}
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
                {offers.map((offer) => {
                  const offerDate = toDate(offer.createdAt);
                  return (
                    <TableRow key={offer.id}>
                      <TableCell className="font-medium">{offer.buyerName}</TableCell>
                      <TableCell>{offer.amount?.toFixed(2) || '0.00'} EUR</TableCell>
                      <TableCell className="max-w-[200px] truncate">{offer.message || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{offer.status}</Badge>
                      </TableCell>
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

      {/* Conversations */}
      <Card>
        <CardHeader><CardTitle>Conversations ({conversations.length})</CardTitle></CardHeader>
        <CardContent>
          {conversations.length > 0 ? (
            <div className="space-y-3">
              {conversations.map((conv) => {
                const lastMsgDate = toDate(conv.lastMessageAt);
                const participantNames = conv.participantDetails?.map((p) => p.name).join(', ') || 'Unknown';
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

      {/* Activity Log */}
      <Card>
        <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : adminLogs.length > 0 ? (
            <div className="space-y-3">
              {adminLogs.map((log) => {
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

      {/* Quick Actions */}
      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <Select value={product.status} onValueChange={handleStatusChange} disabled={isUpdating}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={handleToggleFeatured}
              disabled={isUpdating}
            >
              <Star className={`mr-2 h-4 w-4 ${product.isFeatured ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              {product.isFeatured ? 'Unfeature' : 'Feature'}
            </Button>

            <Button
              variant="destructive"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={isUpdating}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>

            {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
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
