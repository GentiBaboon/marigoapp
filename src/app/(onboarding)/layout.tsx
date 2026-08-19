import { noindexMetadata } from '@/lib/seo';

// First-run flow — thin, personalised and not a search landing page.
export const metadata = noindexMetadata('Welcome to MarigoApp');

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {children}
    </main>
  );
}
