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

  const flatItems = React.useMemo(() => 
    isGrouped(items) 
      ? (items as ComboboxGroup[]).flatMap(g => g.items) 
      : (items as ComboboxItem[]), 
  [items]);
  
  const selectedLabel = value
    ? flatItems.find((item) => item.value.toLowerCase() === value.toLowerCase())?.label
    : placeholder;

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
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyPlaceholder}</CommandEmpty>
            {isGrouped(items) ? (
                (items as ComboboxGroup[]).map((group) => (
                    <CommandGroup key={group.heading} heading={group.heading}>
                        {group.items.map((item) => (
                            <CommandItem
                                key={item.value}
                                value={item.value}
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
                ))
            ) : (
                <CommandGroup>
                    {(items as ComboboxItem[]).map((item) => (
                        <CommandItem
                        key={item.value}
                        value={item.value}
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
