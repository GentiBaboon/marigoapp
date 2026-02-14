'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                This is a placeholder page for your account settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                The full settings interface for notifications, language, and currency will be built out here.
              </p>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
