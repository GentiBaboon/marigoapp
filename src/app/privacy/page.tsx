import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { LegalPage, Section, Bullets, DataTable } from '@/components/legal/legal-page';
import { DEFAULT_REFUND_WINDOW_DAYS } from '@/lib/types';

export const metadata = pageMetadata({
  title: 'Privacy Policy | MarigoApp',
  description:
    'How MarigoApp collects, uses, shares and protects your personal data, and the rights you have under the GDPR.',
  path: '/privacy',
});

// Bump by hand when the policy actually changes. See the note in legal-page.tsx.
const LAST_UPDATED = '20 August 2026';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          <p>
            This explains what we do with your personal data when you use www.marigoapp.com or the
            Marigo apps. MarigoApp, based in Tirana, Albania, is the data controller.
          </p>
          <p className="mt-3">
            We serve people in Albania, Italy and the wider EU, so we apply the General Data
            Protection Regulation (GDPR) to everyone, wherever you live.
          </p>
          <p className="mt-3">
            Questions, or want to exercise a right?{' '}
            <a href="mailto:privacy@marigoapp.com" className="underline underline-offset-2">
              privacy@marigoapp.com
            </a>
            .
          </p>
        </>
      }
    >
      <Section n={1} title="What we collect">
        <DataTable
          rows={[
            ['Account', 'Name, email address, password (stored hashed, never in readable form), phone number, profile photo, language and currency preference.'],
            ['Selling', 'Listing photographs and descriptions, pickup address, payout account details held by Stripe, and identity documents where verification is required.'],
            ['Buying', 'Delivery address, order history, offers made and received.'],
            ['Payment', 'Card payments are handled by Stripe. We receive the outcome, the last four digits and the card type — never the full card number.'],
            ['Messages', 'Conversations with other users, with support, and with the shopping assistant.'],
            ['Technical', 'IP address, device and browser type, pages viewed, and approximate location derived from IP.'],
            ['Cookies', 'A session cookie, a CSRF token, and your language and currency choices. Analytics cookies only where you have accepted them.'],
          ]}
        />
        <p>
          We do not ask for special-category data (health, beliefs, and similar). Please do not put
          it in a listing or a message.
        </p>
      </Section>

      <Section n={2} title="Why we use it, and on what legal basis">
        <DataTable
          rows={[
            ['Run your account and show you the marketplace', 'Performance of a contract'],
            ['Process orders, payments, delivery and payouts', 'Performance of a contract'],
            ['Handle returns, refunds and disputes', 'Performance of a contract; legal obligation'],
            ['Send transactional email — order updates, offers, password resets', 'Performance of a contract'],
            ['Prevent fraud, keep the marketplace safe, enforce our terms', 'Legitimate interests'],
            ['Improve the product and understand how it is used', 'Legitimate interests, or consent for analytics cookies'],
            ['Marketing email', 'Consent — withdrawable at any time'],
            ['Identity and anti-money-laundering checks', 'Legal obligation'],
            ['Keep accounting and tax records', 'Legal obligation'],
          ]}
        />
        <p>
          Where we rely on legitimate interests we have considered the impact on you, and you can
          object — see section 6.
        </p>
      </Section>

      <Section n={3} title="Who we share it with">
        <p>
          We do not sell your personal data. We share it with the following processors, each only to
          the extent they need it:
        </p>
        <DataTable
          rows={[
            ['Google (Firebase)', 'Authentication, database and file storage — the core of the service.'],
            ['Supabase', 'Storage for listing photographs.'],
            ['Vercel', 'Hosting and delivery of the website and API.'],
            ['Stripe', 'Card payments and seller payouts. Stripe is a controller in its own right for payment data; see its own privacy policy.'],
            ['SendGrid (Twilio)', 'Sending transactional email.'],
            ['Google AI', 'Generating listing descriptions and prices, background removal, search and the shopping assistant. Receives the content you submit to those features.'],
            ['Google Analytics', 'Usage statistics, only where you accept analytics cookies.'],
            ['Courier partners', 'Name, delivery address and phone number, so your order can be delivered.'],
          ]}
        />
        <p>
          <strong>Other users see some of your data.</strong> A seller receives the delivery details
          needed to fulfil your order. A buyer sees your public seller profile — display name, photo,
          rating and listings. Messages are visible to the person you send them to.
        </p>
        <p>
          We may also disclose data where the law requires it, or to establish or defend legal
          claims.
        </p>
      </Section>

      <Section n={4} title="Where your data goes">
        <p>
          Several of the providers above are in the United States. Where data leaves the EEA we rely
          on the European Commission&rsquo;s Standard Contractual Clauses, or on an adequacy
          decision where one applies. You can ask us for details of the safeguards in place.
        </p>
      </Section>

      <Section n={5} title="How long we keep it">
        <Bullets
          items={[
            'Account data: while your account is open, then up to 12 months after closure in case you return or a dispute arises.',
            'Orders, invoices and payment records: 10 years, which is the accounting and tax retention period we are subject to.',
            <>Returns and dispute records: 3 years from resolution — longer than the {DEFAULT_REFUND_WINDOW_DAYS}-day return window, so we can evidence a decision if it is challenged.</>,
            'Messages: while your account is open, and afterwards where they form part of an order or a dispute.',
            'Listing photographs: while the listing is published, and for completed orders as part of the order record.',
            'Analytics: up to 14 months.',
          ]}
        />
      </Section>

      <Section n={6} title="Your rights">
        <p>Under the GDPR you can ask us to:</p>
        <Bullets
          items={[
            'give you a copy of the data we hold about you, in a portable format;',
            'correct anything inaccurate — much of this you can do yourself in your profile;',
            'delete your data, where we do not have to keep it for the reasons in section 5;',
            'restrict or stop a particular use;',
            'object to processing based on legitimate interests, including profiling for recommendations;',
            'withdraw consent — for marketing or analytics cookies — at any time, without affecting what was done before.',
          ]}
        />
        <p>
          Email{' '}
          <a href="mailto:privacy@marigoapp.com" className="underline underline-offset-2">
            privacy@marigoapp.com
          </a>
          . We reply within one month. We may need to verify your identity first, so that nobody
          else can obtain your data by asking.
        </p>
        <p>
          You can also complain to a supervisory authority — in Albania, the Information and Data
          Protection Commissioner; in the EU, the authority where you live.
        </p>
      </Section>

      <Section n={7} title="Cookies">
        <p>
          Strictly necessary cookies keep you signed in, protect forms against cross-site request
          forgery, and remember your language and currency. These cannot be switched off, because
          the service does not work without them.
        </p>
        <p>
          Analytics cookies are only set if you accept them in the banner. Declining does not reduce
          what the site does for you. You can change your mind by clearing cookies for this site and
          choosing again.
        </p>
      </Section>

      <Section n={8} title="Automated decisions and AI">
        <p>
          The shopping assistant, search ranking, product recommendations and suggested listing
          prices are automated. Content you submit to those features is sent to our AI provider to
          be processed.
        </p>
        <p>
          None of these makes a decision with a legal or similarly significant effect on you. Listing
          moderation, account suspension and dispute outcomes are reviewed by a person, and you can
          contest any of them by contacting us.
        </p>
      </Section>

      <Section n={9} title="Security">
        <p>
          Traffic is encrypted in transit. Passwords are hashed and never stored in readable form.
          Access to production data is restricted, and payment card details reach Stripe directly
          rather than passing through our systems.
        </p>
        <p>
          No system is perfectly secure. If a breach were to put your rights at risk we would notify
          you and the relevant authority as the GDPR requires.
        </p>
      </Section>

      <Section n={10} title="Children">
        <p>
          Marigo is for adults. We do not knowingly collect data from anyone under 18. If you
          believe a child has given us data, contact us and we will delete it.
        </p>
      </Section>

      <Section n={11} title="Changes">
        <p>
          We will post any updated policy here and change the date at the top. Where a change
          materially affects you, we will tell you by email or in the app before it takes effect.
        </p>
      </Section>

      <Section n={12} title="Contact">
        <p>
          MarigoApp, Tirana, Albania —{' '}
          <a href="mailto:privacy@marigoapp.com" className="underline underline-offset-2">
            privacy@marigoapp.com
          </a>
        </p>
        <p>
          See also our{' '}
          <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
