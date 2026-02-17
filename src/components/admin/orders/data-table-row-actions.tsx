'use client';

import { Row } from '@tanstack/react-table';
import { MoreHorizontal, View, Truck, Undo, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem>
          <View className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem>
            <Truck className="mr-2 h-4 w-4" />
            Add Tracking
        </DropdownMenuItem>
         <DropdownMenuItem>
            <MessageSquare className="mr-2 h-4 w-4" />
            Message Buyer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                Update Status
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
                <DropdownMenuSubContent>
                   {/* Add status options here */}
                </DropdownMenuSubContent>
            </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">
          <Undo className="mr-2 h-4 w-4" />
          Refund/Cancel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
