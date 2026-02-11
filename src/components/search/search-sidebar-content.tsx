'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Slider } from '@/components/ui/slider';
import {
  categories,
  brands,
  productConditions,
  productSizes,
  productColors,
  productMaterials,
} from '@/lib/mock-data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSidebar } from '@/components/ui/sidebar';
import { X } from 'lucide-react';

export function SearchSidebarContent() {
  const { isMobile, setOpenMobile } = useSidebar();
  const [priceRange, setPriceRange] = React.useState([0, 5000]);

  return (
    <>
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-xl font-bold">Filters</h2>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setOpenMobile(false)}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </SidebarHeader>
      <ScrollArea className="flex-1">
        <SidebarContent className="p-0">
          <Accordion
            type="multiple"
            defaultValue={['category', 'price']}
            className="w-full"
          >
            <AccordionItem value="category">
              <AccordionTrigger className="px-4">Category</AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-3">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox id={`cat-${category.id}`} />
                      <Label htmlFor={`cat-${category.id}`}>{category.name}</Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="brand">
              <AccordionTrigger className="px-4">Brand</AccordionTrigger>
              <AccordionContent className="px-4">
                <Combobox
                  items={brands.map((brand) => ({
                    value: brand.slug,
                    label: brand.name,
                  }))}
                  placeholder="Search brands..."
                  searchPlaceholder="Search brands..."
                  emptyPlaceholder="No brands found."
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="price">
              <AccordionTrigger className="px-4">Price</AccordionTrigger>
              <AccordionContent className="px-6 pt-2">
                <Slider
                  min={0}
                  max={10000}
                  step={10}
                  value={priceRange}
                  onValueChange={setPriceRange}
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>€{priceRange[0]}</span>
                  <span>€{priceRange[1]}</span>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="condition">
              <AccordionTrigger className="px-4">Condition</AccordionTrigger>
              <AccordionContent className="px-4">
                <RadioGroup>
                  {productConditions.map((condition) => (
                    <div
                      key={condition.value}
                      className="flex items-center space-x-2"
                    >
                      <RadioGroupItem
                        value={condition.value}
                        id={`cond-${condition.value}`}
                      />
                      <Label htmlFor={`cond-${condition.value}`}>
                        {condition.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="size">
              <AccordionTrigger className="px-4">Size</AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-3">
                  {productSizes.map((size) => (
                    <div
                      key={size}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox id={`size-${size}`} />
                      <Label htmlFor={`size-${size}`}>{size}</Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="color">
              <AccordionTrigger className="px-4">Color</AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="flex flex-wrap gap-3">
                    {productColors.map(color => (
                        <Button key={color.name} variant="outline" size="icon" className="rounded-full">
                            <div className="h-6 w-6 rounded-full border" style={{ backgroundColor: color.hex }}></div>
                            <span className="sr-only">{color.name}</span>
                        </Button>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>

             <AccordionItem value="material" className="border-b-0">
              <AccordionTrigger className="px-4">Material</AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-3">
                  {productMaterials.map((material) => (
                    <div
                      key={material}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox id={`mat-${material}`} />
                      <Label htmlFor={`mat-${material}`}>{material}</Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </SidebarContent>
      </ScrollArea>
      <SidebarFooter className="border-t p-4">
        <Button className="w-full">Apply Filters</Button>
        <Button variant="outline" className="w-full">
          Clear All
        </Button>
      </SidebarFooter>
    </>
  );
}
