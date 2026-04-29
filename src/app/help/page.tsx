'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="container mx-auto py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-4">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Chat with MarigoAI
              </CardTitle>
              <CardDescription>
                Get instant answers from our AI assistant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.dispatchEvent(new Event('open-chatbot'))}>
                Start a conversation
              </Button>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
