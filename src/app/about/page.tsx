'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AboutPage() {
  return (
    <div className="container mx-auto py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>About Marigo</CardTitle>
              <CardDescription>
                Learn more about our mission and story.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                <strong>marigo</strong> is a curated C2C marketplace for new and pre-loved luxury fashion, connecting style enthusiasts across Albania, Italy, and Europe.
              </p>
               <p>
                Our mission is to make luxury accessible and sustainable, fostering a community built on trust, quality, and a shared passion for timeless design.
              </p>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
