import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { LegalPage, Section, Bullets } from '@/components/legal/legal-page';
import {
  DEFAULT_COMMISSION_RATE,
  DEFAULT_PAYOUT_HOLD_HOURS,
  DEFAULT_REFUND_WINDOW_DAYS,
  DEFAULT_SHIPPING_FEE_ALL,
} from '@/lib/types';

export const metadata = pageMetadata({
  title: 'Terms of Service | MarigoApp',
  description:
    'The terms that govern buying, selling, payment, delivery and returns on the MarigoApp pre-owned luxury marketplace.',
  path: '/terms',
});

// Bump this by hand when the terms actually change. It is the date a regulator
// or a court would look at, so it must not float with the render.
const LAST_UPDATED = '20 August 2026';

const COMMISSION_PCT = Math.round(DEFAULT_COMMISSION_RATE * 100);

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          <p>
            These terms are an agreement between you and MarigoApp (&ldquo;Marigo&rdquo;,
            &ldquo;we&rdquo;, &ldquo;us&rdquo;), operating from Tirana, Albania. They govern your use
            of www.marigoapp.com and our iOS and Android apps.
          </p>
          <p className="mt-3">
            The most important thing to understand is in section 4:{' '}
            <strong>Marigo is a marketplace, not a shop.</strong> When you buy, your contract for the
            item is with the seller. We provide the platform, hold the payment, and arrange delivery.
          </p>
          <p className="mt-3">
            By creating an account or placing an order you accept these terms. If you do not accept
            them, please do not use the service.
          </p>
        </>
      }
    >
      <Section n={1} title="Who may use Marigo">
        <p>
          You must be at least 18 and legally able to enter a contract. You may hold one account
          unless we agree otherwise in writing. Everything done through your account is treated as
          done by you, so keep your password to yourself and tell us immediately if you think
          someone else has access.
        </p>
        <p>
          We may refuse, suspend or close an account where we reasonably believe these terms have
          been broken, where we are required to by law, or to protect other users from harm or
          fraud.
        </p>
      </Section>

      <Section n={2} title="Your account">
        <p>
          Keep your details accurate. Sellers and couriers may be asked for identity documents so we
          can meet anti-fraud and anti-money-laundering obligations, and payouts can be withheld
          until those checks are complete.
        </p>
        <p>
          You can close your account at any time from your profile. Closing it does not cancel
          orders already in progress or remove records we must keep — see the{' '}
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </Section>

      <Section n={3} title="What we sell — and what we do not">
        <p>
          Items on Marigo are pre-owned goods listed by their owners. Listings are reviewed before
          publication and we may reject or remove any of them, but a review is not a guarantee: we
          do not physically hold, inspect or take possession of items before they are delivered.
        </p>
        <p>
          Where a listing is marked as authenticated, that reflects the checks described on the
          listing itself and nothing more.
        </p>
      </Section>

      <Section n={4} title="Marigo is a marketplace, not the seller">
        <p>
          The sale contract is between the buyer and the seller. Marigo is not a party to it and
          does not own the items listed.
        </p>
        <p>
          We do act on your behalf in specific, limited ways: we collect payment, hold it, arrange
          delivery, and pay the seller once the conditions in section 7 are met. Those services are
          ours; the item is not.
        </p>
        <p>
          Where a seller is a business trading with a consumer, the seller carries the obligations a
          trader owes under consumer law. Most sellers on Marigo are private individuals, and a
          private sale carries fewer statutory rights — but our own returns and disputes process in
          section 9 applies to every order regardless.
        </p>
      </Section>

      <Section n={5} title="Buying">
        <Bullets
          items={[
            'Prices are set by sellers. Prices are settled in euro; the interface can display Albanian lek or US dollars, and the converted figure is indicative only.',
            'Where a seller accepts offers you may make one. An accepted offer sets the price for that item, and the price is re-read from our records at checkout rather than taken from your basket.',
            <>
              Delivery is charged per order at the rate shown at checkout — currently{' '}
              {DEFAULT_SHIPPING_FEE_ALL} ALL, and shown again before you pay.
            </>,
            'Placing an order is an offer to buy. The contract forms when the seller accepts and the item is dispatched.',
            'Stock is limited and often a single unit. An order can be cancelled and refunded if the item turns out to be unavailable.',
          ]}
        />
      </Section>

      <Section n={6} title="Payment and escrow">
        <p>
          Card payments are processed by Stripe. We never see or store your full card number.
        </p>
        <p>
          Payment works as escrow. At checkout the amount is <em>authorised</em> on your card, not
          taken. It is captured after the item is delivered, and released to the seller after a
          holding period — currently {DEFAULT_PAYOUT_HOLD_HOURS} hours from delivery — during which
          you can raise a problem.
        </p>
        <p>
          If an order is cancelled before capture, the authorisation is released. Depending on your
          bank it can take a few working days for the pending amount to disappear from your
          statement.
        </p>
      </Section>

      <Section n={7} title="Selling">
        <p>By listing an item you confirm that:</p>
        <Bullets
          items={[
            'you own it and are entitled to sell it;',
            'it is authentic, and not a replica, copy or counterfeit;',
            'your description, photographs, condition grade and measurements are accurate, and the photographs are of the actual item;',
            'the sale does not breach anyone else’s rights or any law that applies to you.',
          ]}
        />
        <p>
          Listing an item is a binding commitment to sell it at the stated price if a buyer
          purchases it.
        </p>
        <p>
          <strong>Commission.</strong> We charge {COMMISSION_PCT}% of the item price on a completed
          sale. The rate applicable to your sale is shown in the listing flow and in your earnings
          screen. Delivery is paid by the buyer and is not deducted from your earnings.
        </p>
        <p>
          <strong>Payouts.</strong> Earnings are paid to your connected Stripe account after the
          holding period in section 6. We may pause a payout while a return, dispute or fraud check
          is open.
        </p>
      </Section>

      <Section n={8} title="Prohibited items and conduct">
        <p>
          Counterfeit goods are the one thing this marketplace cannot tolerate. Listing a replica —
          knowingly or not — will have the listing removed, and repeat or deliberate cases will have
          the account closed and payouts withheld pending investigation.
        </p>
        <p>You must not:</p>
        <Bullets
          items={[
            'list counterfeit, stolen, or otherwise unlawful goods;',
            'list anything you do not physically possess;',
            'arrange payment or delivery outside Marigo in order to avoid fees, which also removes every protection in these terms;',
            'use another person’s identity, payment method or account;',
            'harass other users, or use the messaging and review features to abuse, threaten or spam;',
            'scrape, probe or attempt to disrupt the service, or work around its security.',
          ]}
        />
      </Section>

      <Section n={9} title="Delivery, returns and disputes">
        <p>
          Delivery is arranged by Marigo through its courier partners. Sellers must make the item
          available for collection promptly and package it adequately; risk passes to the buyer on
          delivery.
        </p>
        <p>
          If an item does not arrive, or is materially not as described, open a return from the
          order screen within {DEFAULT_REFUND_WINDOW_DAYS} days of delivery. We will ask both sides
          for their account and may ask for photographs.
        </p>
        <p>
          Where a return is upheld, the buyer is refunded and the seller is not paid for that order.
          Where it is not, the payment is released to the seller. We make that decision reasonably
          and in good faith on the evidence available to us, and it does not remove any right you
          have to pursue the other party or a claim through your bank.
        </p>
        <p>
          Statutory rights, including any right of withdrawal you have when buying from a business
          seller, are unaffected by this section.
        </p>
      </Section>

      <Section n={10} title="Your content">
        <p>
          You keep ownership of the photographs and text you upload. You grant us a non-exclusive,
          worldwide, royalty-free licence to host, resize, display and distribute that content for
          the purpose of operating and promoting the marketplace, including in search results,
          category pages and — where the listing is public — search engines and social previews.
        </p>
        <p>
          This licence continues for content attached to completed orders and to listings that
          remain published, and otherwise ends when you delete the content.
        </p>
      </Section>

      <Section n={11} title="AI-assisted features">
        <p>
          Some features are generated by automated systems: listing descriptions and suggested
          prices, background removal, search results, product recommendations and the shopping
          assistant. To provide them, the relevant content — photographs, listing text, or your
          message to the assistant — is sent to our AI provider for processing.
        </p>
        <p>
          Output is a suggestion, not a valuation or a professional opinion, and can be wrong. You
          are responsible for what your listing finally says: check a generated description and
          price before you publish. A suggested price is not an appraisal and is not a promise that
          an item will sell.
        </p>
      </Section>

      <Section n={12} title="Availability">
        <p>
          We aim to keep Marigo available but do not promise uninterrupted service. Features can
          change, and we may suspend the service for maintenance or for security reasons. Where a
          change materially reduces something you have already paid for, we will put it right.
        </p>
      </Section>

      <Section n={13} title="Liability">
        <p>
          Nothing here limits liability for death or personal injury caused by our negligence, for
          fraud, or for anything else that cannot lawfully be limited — including your statutory
          consumer rights.
        </p>
        <p>
          Subject to that: we are not liable for the acts or omissions of buyers, sellers or
          couriers; for the condition, authenticity or legality of items listed by others; or for
          indirect or consequential loss. Our total liability in connection with an order is limited
          to the amount paid for that order.
        </p>
      </Section>

      <Section n={14} title="Changes to these terms">
        <p>
          We may update these terms. Where a change materially affects your rights we will give
          reasonable notice by email or in the app before it takes effect. Continuing to use Marigo
          after that means you accept the change. The version in force for an order is the version
          published when the order was placed.
        </p>
      </Section>

      <Section n={15} title="Law and disputes">
        <p>
          These terms are governed by Albanian law, and the courts of Tirana have jurisdiction.
        </p>
        <p>
          If you are a consumer resident in the EU or the EEA, this does not deprive you of the
          protection of the mandatory consumer law of the country in which you live, or of your
          right to bring proceedings there.
        </p>
        <p>Please contact us first — most problems are resolved faster that way.</p>
      </Section>

      <Section n={16} title="Contact">
        <p>
          MarigoApp, Tirana, Albania —{' '}
          <a href="mailto:hello@marigoapp.com" className="underline underline-offset-2">
            hello@marigoapp.com
          </a>
        </p>
        <p>
          See also our{' '}
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link> and
          our <Link href="/help" className="underline underline-offset-2">Help pages</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
