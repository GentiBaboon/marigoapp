'use client';
import { useEffect } from 'react';
import { CheckCircle, Home, Plus } from 'lucide-react';
import ReactConfetti from 'react-confetti';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSellForm } from '@/components/sell/SellFormContext';

export function SuccessStep() {
    const { resetForm } = useSellForm();

    useEffect(() => {
        resetForm();
    }, [resetForm]);


  return (
    <>
      <ReactConfetti width={typeof window !== 'undefined' ? window.innerWidth : 0} height={typeof window !== 'undefined' ? window.innerHeight : 0} />
      <Card className="text-center">
        <CardHeader className="items-center">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <CardTitle className="font-headline text-3xl">Congratulations!</CardTitle>
          <CardDescription>
            Your item has been successfully listed on Marigo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You can now view your listing or list another item.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild className="w-full">
              <Link href="/home">
                <Home className="mr-2 h-4 w-4" /> Go to Homepage
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sell">
                <Plus className="mr-2 h-4 w-4" /> List Another Item
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
