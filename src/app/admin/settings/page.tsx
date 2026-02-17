'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { productCategories, brands } from '@/lib/mock-data';

// Mock data for coupons
const mockCoupons = [
    { id: 'coupon-1', code: 'WELCOME15', discount: '15%', status: 'Active' },
    { id: 'coupon-2', code: 'SUMMER24', discount: '€20', status: 'Active' },
    { id: 'coupon-3', code: 'OLDCODE', discount: '10%', status: 'Expired' },
];


export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your marketplace settings and configurations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          {/* Categories */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>Manage your product categories.</CardDescription>
                  </div>
                  <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {productCategories.map(category => (
                        <div key={category.name} className="space-y-2">
                             <h4 className="font-semibold text-md">{category.name}</h4>
                             <div className="border rounded-md">
                                {category.subcategories.map((sub, index) => (
                                    <div key={sub.slug} className={`flex justify-between items-center p-3 ${index < category.subcategories.length - 1 ? 'border-b' : ''}`}>
                                        <span>{sub.name}</span>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    ))}
                </div>
            </CardContent>
          </Card>

          {/* Brands */}
           <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Brands</CardTitle>
                    <CardDescription>Manage your product brands.</CardDescription>
                  </div>
                  <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Brand
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    {brands.slice(0, 5).map((brand, index) => ( // Show first 5 for brevity
                        <div key={brand.slug} className={`flex justify-between items-center p-3 ${index < 4 ? 'border-b' : ''}`}>
                            <span>{brand.name}</span>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="link" className="p-0 h-auto">View all brands...</Button>
            </CardFooter>
          </Card>

           {/* Coupons */}
           <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Coupons</CardTitle>
                    <CardDescription>Manage discount codes.</CardDescription>
                  </div>
                  <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Coupon
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    {mockCoupons.map((coupon, index) => (
                        <div key={coupon.id} className={`flex justify-between items-center p-3 ${index < mockCoupons.length - 1 ? 'border-b' : ''}`}>
                            <div>
                                <span className="font-mono bg-muted text-foreground px-2 py-1 rounded-md text-sm">{coupon.code}</span>
                                <span className="ml-4 text-muted-foreground text-sm">{coupon.discount} Discount</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`text-sm font-semibold ${coupon.status === 'Active' ? 'text-green-600' : 'text-red-600'}`}>{coupon.status}</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-1 space-y-8">
            <Card>
            <CardHeader>
                <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                <Label htmlFor="commission-rate">Commission Rate (%)</Label>
                <Input id="commission-rate" type="number" defaultValue="15" />
                </div>
                <Separator />
                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <Label htmlFor="maintenance-mode" className="text-base">Maintenance Mode</Label>
                        <p className="text-sm text-muted-foreground">
                            Temporarily disable public access to the site.
                        </p>
                    </div>
                    <Switch id="maintenance-mode" />
                </div>
            </CardContent>
            <CardFooter>
                <Button className="w-full">Save Settings</Button>
            </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  );
}
