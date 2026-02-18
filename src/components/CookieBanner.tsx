'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Cookie } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'marigo_cookie_consent';

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // This effect runs only on the client
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    setIsVisible(false);
  };
  
  const handleDecline = () => {
    // Here you could implement logic to disable non-essential cookies
    localStorage.setItem(COOKIE_CONSENT_KEY, 'false');
    setIsVisible(false);
  };


  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
        <Card className="container mx-auto max-w-4xl p-4 shadow-lg">
            <CardContent className="p-2 flex flex-col md:flex-row items-center gap-4">
                <Cookie className="h-8 w-8 text-primary flex-shrink-0" />
                <p className="text-sm text-muted-foreground flex-1">
                    We use cookies to enhance your experience, personalize content, and analyze our traffic. By clicking "Accept", you agree to our use of cookies. Read our{' '}
                    <Link href="/privacy" className="underline hover:text-primary">
                        Privacy Policy
                    </Link>.
                </p>
                <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" onClick={handleDecline}>Decline</Button>
                    <Button onClick={handleAccept}>Accept</Button>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
