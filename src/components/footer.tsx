import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/logo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PartnerLogos } from '@/components/PartnerLogos';
import { buildCategoryPath } from '@/lib/category-url';

export function Footer() {
  return (
    <footer className="bg-background border-t hidden md:block">
      <div className="container mx-auto py-12 px-4">
        {/* The brand column is wider than the link columns: it holds the
            supporter logos, which overflowed into "Shop" at an even split. */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo size="md" className="mb-4" />
            <p className="text-muted-foreground">Buy and Sell Fashion, Beauty and Art.</p>
            {/* The language picker used to sit here. It offered a single
                language, which is a control that only ever looks broken —
                it comes back when there is a second one to switch to. */}
            <PartnerLogos />
          </div>
          <div>
            <h3 className="font-semibold mb-4">Shop</h3>
            <ul className="space-y-2 text-muted-foreground">
              {/* The gender landing pages, not /browse/{gender}. A single
                  browse segment is resolved against top-level CATEGORY slugs,
                  so /browse/women matched nothing and rendered "Category not
                  found" — the header already links this way. Built through
                  buildCategoryPath so the vocabulary lives in one place. */}
              <li><Link href={buildCategoryPath('women')} className="hover:text-primary">Womenswear</Link></li>
              <li><Link href={buildCategoryPath('men')} className="hover:text-primary">Menswear</Link></li>
              <li><Link href={buildCategoryPath('children')} className="hover:text-primary">Children</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">About</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/about" className="hover:text-primary">About Us</Link></li>
              <li><Link href="/help" className="hover:text-primary">Help Center</Link></li>
              <li><Link href="/terms" className="hover:text-primary">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Newsletter</h3>
            <p className="text-muted-foreground mb-4">Subscribe for updates and offers.</p>
            <div className="flex w-full max-w-sm items-center space-x-2">
              <Input type="email" placeholder="Email" />
              <Button type="submit">Subscribe</Button>
            </div>
          </div>
        </div>
        <Separator className="my-8" />
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Marigo. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
