
import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/header';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site';
import { MobileNav } from '@/components/mobile-nav';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { ShoppingPreferenceModal } from '@/components/home/ShoppingPreferenceModal';
import { DownloadAppBanner } from '@/components/home/DownloadAppBanner';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { LanguageProvider } from '@/context/LanguageContext';
import dynamic from 'next/dynamic';
import { CookieBanner } from '@/components/CookieBanner';
import { Footer } from '@/components/footer';
import { NativeRouteBridge } from '@/components/platform/NativeRouteBridge';

const ChatbotWidget = dynamic(() => import('@/components/ai/ChatbotWidget').then(mod => mod.ChatbotWidget), {
  ssr: false,
});


export const metadata: Metadata = {
  // metadataBase lets every page emit absolute canonical/OG URLs from relative
  // paths, and stops Next warning about relative URLs in social metadata.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'MarigoApp | Luxury Fashion Marketplace for Albania & EU',
    // Product and category pages supply their own full title.
    template: '%s',
  },
  description: 'Buy and sell authentic luxury fashion. MarigoApp connects style enthusiasts across Albania, Italy, and Europe with a curated selection of pre-loved treasures.',
  keywords: 'luxury fashion, albania, marketplace, second hand, designer brands, chanel, hermes, gucci',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'MarigoApp | Discover Luxury Fashion',
    description: 'The trusted marketplace for authentic pre-owned luxury.',
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: absoluteUrl('/og-image.jpg'),
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MarigoApp | Discover Luxury Fashion',
    description: 'The trusted marketplace for authentic pre-owned luxury.',
    images: [absoluteUrl('/og-image.jpg')],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE_NAME,
    "url": SITE_URL,
    "logo": absoluteUrl('/icons/icon-512x512.png'),
    "sameAs": [
      "https://www.instagram.com/marigoapp",
      "https://www.facebook.com/marigoapp"
    ]
  };

  // Enables the sitelinks search box in Google results.
  const searchLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "url": SITE_URL,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": absoluteUrl('/search?q={search_term_string}'),
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="sq" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* No <link rel="icon"> here on purpose. `src/app/icon.png` and
            `src/app/apple-icon.png` are App Router conventions — Next emits the
            tags itself. A `src/app/favicon.ico` used to sit alongside them and
            won at /favicon.ico, which is why browsers kept showing the old
            orange mark no matter what this file said. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(searchLd) }}
        />
      </head>
      <body className={cn('font-body antialiased')}>
        {/* Rewrites /products/${id} style links to the flat routes the static
            native bundle actually contains. Renders nothing, and attaches no
            listener at all on web. */}
        <NativeRouteBridge />
        <FirebaseClientProvider>
            <LanguageProvider>
                <CurrencyProvider>
                  <CartProvider>
                    <WishlistProvider>
                      {/* dvh, not vh: on iOS the visible viewport grows when
                          Safari's toolbars collapse, and vh keeps reporting the
                          expanded-toolbar height. */}
                      <div className="relative flex min-h-[100dvh] flex-col">
                        <AnnouncementBar />
                        <Header />
                        {/* flex column so full-height pages can claim the
                            leftover space with `flex-1` instead of subtracting
                            a hardcoded guess at the chrome above them. */}
                        <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>
                        <ChatbotWidget />
                        <MobileNav />
                        <ShoppingPreferenceModal />
                        <DownloadAppBanner />
                        <Footer />
                      </div>
                      <Toaster />
                      <CookieBanner />
                    </WishlistProvider>
                  </CartProvider>
                </CurrencyProvider>
            </LanguageProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
