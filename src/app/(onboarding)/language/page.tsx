'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/hooks/use-i18n';

export default function LanguagePickerPage() {
  const router = useRouter();
  const { setLocale, t } = useI18n();

  const handleLanguageSelect = (language: 'sq' | 'en' | 'it') => {
    setLocale(language);
    router.push('/welcome');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">
            {t('LanguagePicker.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <Button
              size="lg"
              className="w-full"
              onClick={() => handleLanguageSelect('sq')}
            >
              {t('LanguagePicker.albanian')}
            </Button>
            <Button
              size="lg"
              className="w-full"
              onClick={() => handleLanguageSelect('en')}
            >
              {t('LanguagePicker.english')}
            </Button>
            <Button
              size="lg"
              className="w-full"
              onClick={() => handleLanguageSelect('it')}
            >
              {t('LanguagePicker.italian')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
