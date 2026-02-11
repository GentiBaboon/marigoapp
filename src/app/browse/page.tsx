import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function BrowsePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Browse</CardTitle>
          <CardDescription>
            This is a placeholder page for browsing products.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            The full browsing and filtering experience will be built out here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
