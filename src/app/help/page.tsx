'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function HelpPage() {
  return (
    <div className="container mx-auto py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Help Center</CardTitle>
              <CardDescription>
                This is a placeholder page for help and support.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                The full help center with FAQs and contact information will be built out here.
              </p>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
