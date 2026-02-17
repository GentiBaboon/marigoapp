'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Shield, MessageSquare, Star, Trash2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

// Mock Data - Replace with real data from Firestore later
const mockReports = [
    { id: 'report-prod-1', type: 'product', itemId: 'prod-123', reason: 'Counterfeit item', status: 'pending', reporter: 'Jane Doe', details: { title: 'Luxury Handbag', image: 'https://picsum.photos/seed/product1/200/200' } },
    { id: 'report-user-1', type: 'user', itemId: 'user-456', reason: 'Harassment and spam', status: 'pending', reporter: 'John Smith', details: { name: 'SpammyUser123', avatar: 'https://picsum.photos/seed/user1/40/40' } },
    { id: 'report-msg-1', type: 'message', itemId: 'msg-789', reason: 'Inappropriate language', status: 'pending', reporter: 'Alice', details: { content: 'This is an example of a very rude message...', author: 'RudeUser' } },
    { id: 'report-rev-1', type: 'review', itemId: 'rev-101', reason: 'False information', status: 'pending', reporter: 'Bob', details: { content: 'This review is completely fake and manipulative.', rating: 1, author: 'FakeReviewer' } },
];

const ReportCard = ({ report }: { report: (typeof mockReports)[0] }) => {
    const icons = {
        product: <Shield className="h-4 w-4" />,
        user: <User className="h-4 w-4" />,
        message: <MessageSquare className="h-4 w-4" />,
        review: <Star className="h-4 w-4" />,
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            {icons[report.type as keyof typeof icons]}
                             Reported {report.type}
                        </CardTitle>
                        <CardDescription>Reason: {report.reason}</CardDescription>
                    </div>
                    <Badge variant="destructive">{report.status.toUpperCase()}</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="bg-muted/50 p-3 rounded-lg space-y-3">
                    {report.type === 'product' && (
                         <div className="flex items-center gap-3">
                            <Image src={report.details.image!} alt={report.details.title!} width={64} height={64} className="rounded-md bg-background" />
                            <div>
                                <p className="font-semibold">{report.details.title}</p>
                                <p className="text-sm text-muted-foreground">Item ID: {report.itemId}</p>
                            </div>
                        </div>
                    )}
                    {report.type === 'user' && (
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={report.details.avatar} />
                                <AvatarFallback>{report.details.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold">{report.details.name}</p>
                                <p className="text-sm text-muted-foreground">User ID: {report.itemId}</p>
                            </div>
                        </div>
                    )}
                    {(report.type === 'message' || report.type === 'review') && (
                        <blockquote className="border-l-4 pl-4 italic">
                            "{report.details.content}"
                            <footer className="text-sm text-muted-foreground mt-1">— {report.details.author}</footer>
                        </blockquote>
                    )}
                </div>
                 <Separator className="my-4" />
                 <p className="text-sm text-muted-foreground">Reported by: <span className="font-medium text-foreground">{report.reporter}</span></p>

            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="ghost">Dismiss</Button>
                <Button variant="outline">Warn User</Button>
                <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Content
                </Button>
                 <Button variant="destructive" className="bg-red-700 hover:bg-red-800">
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Ban User
                </Button>
            </CardFooter>
        </Card>
    )
}

export default function AdminModerationPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Moderation</h1>
          <p className="text-muted-foreground">
            Review and take action on reported content.
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="products">
        <TabsList className="grid grid-cols-4 max-w-lg">
            <TabsTrigger value="products">Products ({mockReports.filter(r => r.type === 'product').length})</TabsTrigger>
            <TabsTrigger value="users">Users ({mockReports.filter(r => r.type === 'user').length})</TabsTrigger>
            <TabsTrigger value="messages">Messages ({mockReports.filter(r => r.type === 'message').length})</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({mockReports.filter(r => r.type === 'review').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
            <div className="space-y-4">
                {mockReports.filter(r => r.type === 'product').map(report => <ReportCard key={report.id} report={report} />)}
            </div>
        </TabsContent>
         <TabsContent value="users" className="mt-4">
            <div className="space-y-4">
                {mockReports.filter(r => r.type === 'user').map(report => <ReportCard key={report.id} report={report} />)}
            </div>
        </TabsContent>
         <TabsContent value="messages" className="mt-4">
            <div className="space-y-4">
                {mockReports.filter(r => r.type === 'message').map(report => <ReportCard key={report.id} report={report} />)}
            </div>
        </TabsContent>
        <TabsContent value="reviews" className="mt-4">
            <div className="space-y-4">
                {mockReports.filter(r => r.type === 'review').map(report => <ReportCard key={report.id} report={report} />)}
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
