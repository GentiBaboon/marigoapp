"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type ComboboxItem = { value: string; label: string };
type ComboboxGroup = { heading: string; items: ComboboxItem[] };
type ComboboxData = ComboboxItem[] | ComboboxGroup[];

type ComboboxProps = {
    items: ComboboxData;
    placeholder: string;
    searchPlaceholder: string;
    emptyPlaceholder: string;
    className?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
}

const isGrouped = (items: ComboboxData): items is ComboboxGroup[] => {
    return items.length > 0 && typeof items[0] === 'object' && items[0] !== null && 'heading' in items[0] && 'items' in items[0];
}

export function Combobox({ items, placeholder, searchPlaceholder, emptyPlaceholder, className, value, onValueChange, disabled }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const flatItems = React.useMemo(() => {
    const raw = isGrouped(items)
      ? (items as ComboboxGroup[]).flatMap(g => g.items)
      : (items as ComboboxItem[]);
    // Drop entries missing a value — they would crash the lowercase comparisons below
    // and can't be selected meaningfully anyway.
    return raw.filter((item): item is ComboboxItem => typeof item?.value === 'string' && item.value.length > 0);
  }, [items]);

  const selectedLabel = value
    ? flatItems.find((item) => item.value.toLowerCase() === value.toLowerCase())?.label ?? placeholder
    : placeholder;

  // Substring filter on the visible label and any keywords (e.g. parent group
  // heading). cmdk's default fuzzy scorer matches "shoes" against
  // "shirts-and-blouses" because s-h-…-o-…-e-s appears as a subsequence —
  // confusing for users searching catalogs. Plain substring matching is more
  // predictable and is what shoppers expect.
  const labelFilter = React.useCallback(
    (_value: string, search: string, keywords?: string[]) => {
      const term = search.trim().toLowerCase();
      if (!term) return 1;
      const haystack = (keywords ?? []).join(' ').toLowerCase();
      return haystack.includes(term) ? 1 : 0;
    },
    [],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedLabel}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command filter={labelFilter}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyPlaceholder}</CommandEmpty>
            {isGrouped(items) ? (
                (items as ComboboxGroup[]).map((group) => {
                    const validItems = group.items.filter(
                        (item): item is ComboboxItem => typeof item?.value === 'string' && item.value.length > 0,
                    );
                    if (validItems.length === 0) return null;
                    return (
                        <CommandGroup key={group.heading} heading={group.heading}>
                            {validItems.map((item) => (
                                <CommandItem
                                    key={item.value}
                                    value={item.value}
                                    keywords={[item.label, group.heading]}
                                    onSelect={(currentValue) => {
                                        onValueChange?.(currentValue)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                        "mr-2 h-4 w-4",
                                        value?.toLowerCase() === item.value.toLowerCase() ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {item.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    );
                })
            ) : (
                <CommandGroup>
                    {flatItems.map((item) => (
                        <CommandItem
                        key={item.value}
                        value={item.value}
                        keywords={[item.label]}
                        onSelect={(currentValue) => {
                            onValueChange?.(currentValue)
                            setOpen(false)
                        }}
                        >
                        <Check
                            className={cn(
                            "mr-2 h-4 w-4",
                            value?.toLowerCase() === item.value.toLowerCase() ? "opacity-100" : "opacity-0"
                            )}
                        />
                        {item.label}
                        </CommandItem>
                    ))}
                </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
