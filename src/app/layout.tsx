
import type { Metadata, Viewport } from 'next';
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
import { CurrencyProvider } from '@/context/CurrencyContext';
import { LanguageProvider } from '@/context/LanguageContext';
import dynamic from 'next/dynamic';
import { CookieBanner } from '@/components/CookieBanner';
import { Footer } from '@/components/footer';
import { NativeRouteBridge } from '@/components/platform/NativeRouteBridge';

import { PresenceTracker } from '@/components/analytics/presence-tracker';

const ChatbotWidget = dynamic(() => import('@/components/ai/ChatbotWidget').then(mod => mod.ChatbotWidget), {
  ssr: false,
});


/**
 * `viewportFit: 'cover'` is the switch that makes safe areas exist at all.
 *
 * Without it the WebView lays out inside the safe area and every
 * `env(safe-area-inset-*)` resolves to 0 — so safe-area CSS silently does
 * nothing, which is exactly what was happening here. With it the page paints
 * edge to edge, behind the notch/Dynamic Island and the home indicator, and the
 * insets report real values for the layout to pad against.
 *
 * The theme colour drives the Android status bar and the PWA title bar. It is
 * the announcement bar's purple, because that strip is what sits under the
 * status bar at the top of every screen.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#B884F5',
};

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
  // OnlineStore rather than a bare Organization: it is the type answer engines
  // and Google's merchant surfaces actually reason about, and it carries the
  // trading details (currencies, area served, returns) that a plain
  // Organization has nowhere to put.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${SITE_URL}#organization`,
    "name": SITE_NAME,
    "alternateName": "Marigo",
    "url": SITE_URL,
    "logo": absoluteUrl('/icons/icon-512x512.png'),
    "image": absoluteUrl('/og-image.jpg'),
    "description":
      "A curated marketplace for authenticated pre-owned luxury fashion, serving Albania, Italy and the wider EU.",
    "slogan": "Give your luxury items a new life.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Tirana",
      "addressCountry": "AL",
    },
    "areaServed": [
      { "@type": "Country", "name": "Albania" },
      { "@type": "Country", "name": "Italy" },
      { "@type": "Place", "name": "European Union" },
    ],
    "currenciesAccepted": "EUR, ALL",
    "paymentAccepted": "Credit Card, Debit Card",
    "sameAs": [
      "https://www.instagram.com/marigoapp",
      "https://www.facebook.com/marigoapp"
    ]
  };

  // Enables the sitelinks search box in Google results.
  const searchLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    "name": SITE_NAME,
    "url": SITE_URL,
    "publisher": { "@id": `${SITE_URL}#organization` },
    "inLanguage": ["en", "sq"],
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": absoluteUrl('/search?q={search_term_string}'),
      },
      "query-input": "required name=search_term_string",
    },
  };

  // `en`, not `sq`: LanguageContext defaults to English, so the
  // server-rendered HTML a crawler sees is English. Declaring Albanian told
  // Google the page was in a language it demonstrably was not, which
  // suppresses it for English queries and misfiles it for Albanian ones. The
  // picker still switches the UI to Albanian client-side.
  return (
    <html lang="en" suppressHydrationWarning>
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
                      {/* The status-bar strip. The page paints edge to edge
                          under `viewportFit: 'cover'`, so without an opaque
                          band here the content scrolls visibly behind the
                          clock and battery. Brand purple, so at the top of the
                          page it is continuous with the announcement bar and
                          reads as one strip. Collapses to zero height on
                          desktop and on devices with no inset. */}
                      <div
                        aria-hidden
                        className="fixed inset-x-0 top-0 z-50 h-safe-top bg-primary"
                      />
                      {/* pt-safe-top keeps content clear of the notch; the
                          left/right insets matter in landscape, where the
                          cutout moves to one side. min-h is border-box, so the
                          padding does not push the page past one screen. */}
                      <div className="relative flex min-h-[100dvh] flex-col pt-safe-top pl-safe-left pr-safe-right">
                        <AnnouncementBar />
                        <Header />
                        {/* flex column so full-height pages can claim the
                            leftover space with `flex-1` instead of subtracting
                            a hardcoded guess at the chrome above them. */}
                        <main className="flex flex-1 flex-col pb-nav-safe md:pb-0">{children}</main>
                        <ChatbotWidget />
                        <PresenceTracker />
                        <MobileNav />
                        <ShoppingPreferenceModal />
                        {/* The app-download banner is pulled from the website
                            for now. The component is untouched — mount it here
                            again when the store listings are live. */}
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
