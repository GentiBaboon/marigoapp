import Link from 'next/link';

/**
 * Thin site-wide promo strip that sits above the header.
 *
 * Modelled on the Farfetch treatment: a single centred line at 13px on a light
 * grey band, with the call to action as an underlined inline link rather than a
 * button — so it reads as one sentence instead of a stacked block.
 */
export function AnnouncementBar() {
  return (
    <div className="w-full bg-primary text-white">
      <p className="px-6 py-1.5 text-center text-[13px] leading-normal">
        <span className="font-semibold">First Time?</span>{' '}
        Shop: 15% off with code{' '}
        <span className="font-bold">WELCOME15</span>. Sell: No fees on your first sale.{' '}
        <Link href="/auth/signup" className="font-semibold underline underline-offset-2 hover:no-underline">
          Get Started!
        </Link>
      </p>
    </div>
  );
}
