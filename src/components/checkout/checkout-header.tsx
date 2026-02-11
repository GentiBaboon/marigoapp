import Link from 'next/link';

export function CheckoutHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center">
        <Link href="/" className="flex items-center space-x-2">
          <span className="inline-block font-logo font-bold text-2xl bg-gradient-to-r from-primary to-purple-400 text-transparent bg-clip-text">
            marigo
          </span>
        </Link>
      </div>
    </header>
  );
}
