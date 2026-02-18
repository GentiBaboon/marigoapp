'use client';

import * as React from 'react';
import { Globe, Check } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Locale } from '@/context/I18nProvider';

const languages: { code: Locale; name: string; flag: string }[] = [
  { code: 'sq', name: 'Shqip', flag: '🇦🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change language">
          <Globe className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onSelect={() => setLocale(lang.code)}
          >
            <span className="flex items-center justify-between w-full">
                <span>{lang.flag} {lang.name}</span>
                {locale === lang.code && <Check className="h-4 w-4" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
