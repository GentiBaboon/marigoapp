import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>
            This is a placeholder page for product {params.id}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            The full product details page will be built out here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
