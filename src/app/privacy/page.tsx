import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function PrivacyPage() {
  return (
    <div className="container mx-auto py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold font-headline">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
            
            <Card>
                <CardHeader>
                    <CardTitle>1. Introduction</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>
                        Welcome to MarigoApp. This is a placeholder privacy policy. You should replace this text with your own official policy.
                    </p>
                    <p>
                        This policy explains how we collect, use, and share information about you when you use our services.
                    </p>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>2. Information We Collect</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>
                       We collect information you provide directly to us, such as when you create an account, list an item, or communicate with other users. This may include your name, email address, and shipping information.
                    </p>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>3. How We Use Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>
                       We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.
                    </p>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>4. Your Rights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>
                       You have the right to access, correct, or delete your personal data. You can manage your information from your account settings page.
                    </p>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
