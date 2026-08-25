'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bot, LifeBuoy, Search } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FAQ_SECTIONS } from './faq-content';

/** Accent-insensitive contains, so "cmimi" still finds "çmimi". */
function fold(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function HelpPage() {
  const [query, setQuery] = React.useState('');

  const sections = React.useMemo(() => {
    const q = fold(query.trim());
    if (!q) return FAQ_SECTIONS;
    return FAQ_SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(
        item => fold(item.q).includes(q) || fold(item.a).includes(q)
      ),
    })).filter(section => section.items.length > 0);
  }, [query]);

  const matchCount = sections.reduce((n, s) => n + s.items.length, 0);
  const isSearching = query.trim().length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <h1 className="font-headline text-3xl font-bold sm:text-4xl">Help Centre</h1>
          <p className="text-muted-foreground">
            How buying, selling, delivery and refunds work on MarigoApp. If your
            question is not here, Marigo can answer it in a couple of seconds.
          </p>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the FAQ — delivery, refunds, fees…"
            className="pl-9"
            aria-label="Search the FAQ"
          />
        </div>

        {isSearching && (
          <p className="text-sm text-muted-foreground" role="status">
            {matchCount === 0
              ? 'Nothing matched that.'
              : `${matchCount} ${matchCount === 1 ? 'answer' : 'answers'} matched.`}
          </p>
        )}

        {/* Nothing found is a dead end unless it offers a way out, so the
            assistant card below is the fallback rather than a bare message. */}
        {sections.map(section => (
          <section key={section.id} className="space-y-3">
            <div>
              <h2 className="font-headline text-xl font-bold">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.blurb}</p>
            </div>
            <Accordion
              type="multiple"
              className="rounded-lg border px-4"
              /* Searching reveals every match rather than making the reader
                 open each result to find out whether it was worth the click.
                 Keyed on the query so the remount re-applies the default —
                 swapping between controlled and uncontrolled instead would
                 throw away whatever the reader had already opened by hand. */
              key={isSearching ? `q:${query}` : 'browse'}
              defaultValue={
                isSearching ? section.items.map((_, i) => `${section.id}-${i}`) : []
              }
            >
              {section.items.map((item, i) => (
                <AccordionItem key={item.q} value={`${section.id}-${i}`}>
                  <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                  <AccordionContent className="leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Still stuck?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Marigo, our shopping assistant, knows the catalogue and how the
              platform works — and answers in English or Albanian. Anything she
              cannot settle reaches our team.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => window.dispatchEvent(new Event('open-chatbot'))}>
                <Bot className="mr-2 h-4 w-4" />
                Ask Marigo
              </Button>
              <Button variant="outline" asChild>
                <Link href="/profile/orders">
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Go to my orders
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
