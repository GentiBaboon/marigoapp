import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function NotificationsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            This is a placeholder page for notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Your notifications will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

    