'use client';

import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { ArrowUpDown, ExternalLink, MoreHorizontal, Package, User } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import type { FirestoreOffer } from '@/lib/types';
import { toDate } from '@/lib/types';
import { cn } from '@/lib/utils';
import { currentAmount, effectiveStatus, offerStatusLabel, type OfferStatus } from '@/lib/offers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * One row of the admin offers table: the stored offer plus what the page
 * resolved for it. Offers carry only ids, and an admin scanning a list needs
 * the listing and the two people — so the page joins them once, up front,
 * rather than each cell opening its own listener (100 rows × 3 lookups).
 */
export interface AdminOfferRow extends FirestoreOffer {
  productId: string;
  productTitle: string;
  productImage: string | null;
  /** Asking price today. `originalListingPrice` on the offer is what it was
   *  when the offer was made; the two differ if the seller repriced. */
  listingPrice: number | null;
  sellerId: string;
  sellerName: string;
  sellerEmail: string | null;
  buyerEmail: string | null;
  /** Expiry folded in — see `effectiveStatus`. Precomputed so the status
   *  facet filters on the value the badge shows. */
  effectiveStatus: OfferStatus;
}

const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

const statusStyles: Record<OfferStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900',
  countered: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900',
  accepted: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900',
  declined: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
  withdrawn: 'bg-muted text-muted-foreground border-border',
  expired: 'bg-muted text-muted-foreground border-border',
};

function PersonCell({ name, email, userId }: { name: string; email: string | null; userId: string }) {
  return (
    <div className="flex flex-col leading-tight min-w-0">
      <Link href={`/admin/users/${userId}`} className="text-sm hover:underline truncate max-w-[180px]">
        {name}
      </Link>
      {email && (
        <a
          href={`mailto:${email}`}
          className="text-xs text-muted-foreground hover:text-foreground truncate max-w-[180px]"
        >
          {email}
        </a>
      )}
    </div>
  );
}

export const columns: ColumnDef<AdminOfferRow>[] = [
  {
    accessorKey: 'productTitle',
    header: 'Listing',
    cell: ({ row }) => {
      const { productId, productTitle, productImage } = row.original;
      return (
        <Link href={`/admin/products/${productId}`} className="flex items-center gap-3 min-w-0 group">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
            {productImage ? (
              <Image src={productImage} alt="" fill className="object-cover" sizes="40px" />
            ) : (
              <Package className="h-4 w-4 absolute inset-0 m-auto text-muted-foreground" />
            )}
          </div>
          <span className="truncate max-w-[220px] text-sm font-medium group-hover:underline">
            {productTitle}
          </span>
        </Link>
      );
    },
  },
  {
    accessorKey: 'buyerName',
    header: 'Buyer',
    cell: ({ row }) => (
      <PersonCell
        name={row.original.buyerName || 'Unknown buyer'}
        email={row.original.buyerEmail}
        userId={row.original.buyerId}
      />
    ),
  },
  {
    accessorKey: 'sellerName',
    header: 'Seller',
    cell: ({ row }) => (
      <PersonCell
        name={row.original.sellerName}
        email={row.original.sellerEmail}
        userId={row.original.sellerId}
      />
    ),
  },
  {
    id: 'amount',
    // Sort on the operative figure — after a counter, the buyer's original
    // number is history and the list must agree with what accepting costs.
    accessorFn: (row) => currentAmount({ ...row, status: row.effectiveStatus }),
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-4" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Offer
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const offer = row.original;
      const onTable = currentAmount({ ...offer, status: offer.effectiveStatus });
      const asking = offer.listingPrice ?? offer.originalListingPrice ?? null;
      const below = asking && asking > 0 ? Math.round((1 - onTable / asking) * 100) : null;
      const countered = offer.effectiveStatus === 'countered' && offer.counterOfferAmount != null;
      return (
        <div className="flex flex-col leading-tight">
          <span className="font-medium tabular-nums">{currencyFormatter.format(onTable)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {asking != null ? `of ${currencyFormatter.format(asking)}` : 'asking price unknown'}
            {below != null && below > 0 && ` · ${below}% below`}
            {countered && ` · buyer bid ${currencyFormatter.format(offer.offerAmount ?? offer.amount ?? 0)}`}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'effectiveStatus',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.effectiveStatus;
      return (
        <Badge variant="outline" className={cn('whitespace-nowrap', statusStyles[status])}>
          {offerStatusLabel(status, 'admin')}
        </Badge>
      );
    },
    filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'message',
    header: 'Message',
    cell: ({ row }) => {
      const message = row.original.message?.trim();
      if (!message) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <span className="block max-w-[200px] truncate text-sm" title={message}>
          {message}
        </span>
      );
    },
    enableSorting: false,
  },
  {
    id: 'createdAt',
    accessorFn: (row) => toDate(row.createdAt)?.getTime() ?? 0,
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-4" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const date = toDate(row.original.createdAt);
      return <span className="whitespace-nowrap text-sm">{date ? format(date, 'd MMM yyyy, HH:mm') : '—'}</span>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const { productId, id } = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>View</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/admin/products/${productId}`}>
                <Package className="mr-2 h-4 w-4" />
                Listing in admin
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${row.original.buyerId}`}>
                <User className="mr-2 h-4 w-4" />
                Buyer profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${row.original.sellerId}`}>
                <User className="mr-2 h-4 w-4" />
                Seller profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              {/* Read-only for an admin: `roleFor()` returns null, so the
                  page shows the history and no buttons. */}
              <Link href={`/products/${productId}/offers/${id}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Negotiation thread
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
