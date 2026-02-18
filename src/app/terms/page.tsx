import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function TermsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold font-headline">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
            
            <Card>
                <CardHeader>
                    <CardTitle>1. Acceptance of Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>
                        This is a placeholder Terms of Service document. By accessing or using the MarigoApp service, you agree to be bound by these terms. You should replace this text with your own official policy.
                    </p>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>2. User Conduct</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>
                       You agree not to use the Service to post or transmit any content that is illegal, fraudulent, or infringes on the rights of others. We reserve the right to remove any content and terminate accounts that violate these terms.
                    </p>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>3. Limitation of Liability</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>
                       MarigoApp is provided "as is" without any warranties. We are not liable for any damages arising from your use of the service.
                    </p>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
