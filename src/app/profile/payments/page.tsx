'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function PaymentsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                This is a placeholder page for your payment methods.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                The full interface for managing your payment methods will be built out here.
              </p>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
