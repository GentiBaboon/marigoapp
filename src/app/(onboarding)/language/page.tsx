'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LanguagePickerPage() {
  const router = useRouter();

  const handleLanguageSelect = (language: string) => {
    localStorage.setItem('marigo_language', language);
    router.push('/welcome');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">
            Choose Your Language
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <Button
              size="lg"
              className="w-full"
              onClick={() => handleLanguageSelect('sq')}
            >
              Shqip (Albanian)
            </Button>
            <Button
              size="lg"
              className="w-full"
              onClick={() => handleLanguageSelect('en')}
            >
              English
            </Button>
            <Button
              size="lg"
              className="w-full"
              onClick={() => handleLanguageSelect('it')}
            >
              Italiano (Italian)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
