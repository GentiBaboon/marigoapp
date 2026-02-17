'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, Zap, Calendar, MapPin } from 'lucide-react';

const benefits = [
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: 'Flexible Hours',
    description: 'Work when you want. Set your own schedule and be your own boss.',
  },
  {
    icon: <Truck className="h-8 w-8 text-primary" />,
    title: 'Competitive Pay',
    description: 'Earn great money with every delivery. Get paid weekly for your work.',
  },
  {
    icon: <MapPin className="h-8 w-8 text-primary" />,
    title: 'Local Routes',
    description: 'Stay in your area. We provide you with deliveries in your preferred zones.',
  },
];

export default function DeliveryPartnerPage() {
  return (
    <div className="bg-muted/40">
      <div className="container mx-auto px-4 py-12 md:py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold font-headline mb-4">
          Become a Marigo Delivery Partner
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          Join our fleet of delivery partners and earn money by delivering luxury fashion items to buyers in your city. Enjoy flexibility, competitive pay, and the support of the Marigo community.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/delivery-partner/apply">Start Your Application</Link>
        </Button>
      </div>
      
      <div className="bg-background py-12 md:py-20">
          <div className="container mx-auto px-4">
               <h2 className="text-3xl font-bold text-center mb-10">Why deliver with Marigo?</h2>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   {benefits.map((benefit) => (
                       <Card key={benefit.title} className="text-center">
                           <CardContent className="p-8">
                               <div className="flex justify-center mb-4">{benefit.icon}</div>
                               <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                               <p className="text-muted-foreground">{benefit.description}</p>
                           </CardContent>
                       </Card>
                   ))}
               </div>
          </div>
      </div>
    </div>
  );
}
