'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ListingsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
        <div className="max-w-3xl mx-auto">
            <div className="mb-4">
                 <Button asChild variant="outline">
                    <Link href="/profile">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Profile
                    </Link>
                 </Button>
            </div>
          <Card>
            <CardHeader>
              <CardTitle>My Listings</CardTitle>
              <CardDescription>
                This is a placeholder page for your product listings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                The full interface for managing your active and sold listings will be built out here.
              </p>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
