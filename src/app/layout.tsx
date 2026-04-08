
import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/header';
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

const ChatbotWidget = dynamic(() => import('@/components/ai/ChatbotWidget').then(mod => mod.ChatbotWidget), {
  ssr: false,
});


export const metadata: Metadata = {
  title: 'MarigoApp | Luxury Fashion Marketplace for Albania & EU',
  description: 'Buy and sell authentic luxury fashion. MarigoApp connects style enthusiasts across Albania, Italy, and Europe with a curated selection of pre-loved treasures.',
  keywords: 'luxury fashion, albania, marketplace, second hand, designer brands, chanel, hermes, gucci',
  openGraph: {
    title: 'MarigoApp | Discover Luxury Fashion',
    description: 'The trusted marketplace for authentic pre-owned luxury.',
    url: 'https://www.marigo.app',
    siteName: 'MarigoApp',
    images: [
      {
        url: 'https://www.marigo.app/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
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
    "name": "MarigoApp",
    "url": "https://www.marigo.app",
    "logo": "https://www.marigo.app/icons/icon-512x512.png",
    "sameAs": [
      "https://www.instagram.com/marigoapp",
      "https://www.facebook.com/marigoapp"
    ]
  };

  return (
    <html lang="sq" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
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
      </head>
      <body className={cn('font-body antialiased')}>
        <FirebaseClientProvider>
            <LanguageProvider>
                <CurrencyProvider>
                  <CartProvider>
                    <WishlistProvider>
                      <div className="relative flex min-h-screen flex-col">
                        <Header />
                        <main className="flex-1 pb-16 md:pb-0">{children}</main>
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
