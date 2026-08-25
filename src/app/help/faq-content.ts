import {
  DEFAULT_COMMISSION_RATE,
  DEFAULT_PAYOUT_HOLD_HOURS,
  DEFAULT_REFUND_WINDOW_DAYS,
  DEFAULT_SHIPPING_FEE_ALL,
  CROSS_BORDER_SHIPPING_FEE_ALL,
} from '@/lib/types';

/**
 * @fileOverview The Help Centre's questions and answers.
 *
 * Figures are imported from `src/lib/types.ts` rather than typed out, so the
 * commission, hold window, refund window and delivery fees quoted here cannot
 * drift away from the ones the checkout and payout code actually apply. An FAQ
 * that quietly contradicts the invoice is worse than no FAQ.
 *
 * The prose is deliberately consistent with `src/lib/chat-knowledge.ts`, which
 * is the same ground truth handed to the AI assistant — change one, check the
 * other, or the page and the chatbot will start disagreeing in public.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqSection {
  id: string;
  title: string;
  blurb: string;
  items: FaqItem[];
}

const commissionPct = Math.round(DEFAULT_COMMISSION_RATE * 100);
const sellerKeepsPct = 100 - commissionPct;

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'buying',
    title: 'Buying',
    blurb: 'Finding something, agreeing a price, and paying for it.',
    items: [
      {
        q: 'How do I find something specific?',
        a: 'Use the search icon in the header, or browse from the home page. On the search screen you can narrow by brand, category, size, colour, material, condition, pattern and price. Every item is a single, individual piece — once it sells, that exact listing is gone, so if something catches your eye it is worth saving to your favourites.',
      },
      {
        q: 'Can I pay less than the asking price?',
        a: 'Often, yes. If a seller has offers enabled you will see a "Make an offer" button on the listing. Send an amount and the seller can accept it, decline it, or counter with a price of their own — and you can counter back. An offer waits for whoever has the turn, and expires on its own if nobody acts. You can follow all of yours under Offers in your profile.',
      },
      {
        q: 'What happens after I place an order?',
        a: 'Your order moves through pending payment → processing → shipped → delivered → completed. You can follow it in Orders in your profile, and you will get a notification as each stage changes. An order can also end as cancelled or refunded.',
      },
      {
        q: 'Is the item really authentic?',
        a: 'Listings are reviewed before they go live, and items that have been through an authenticity check carry a badge on the listing. If you have doubts about a specific piece, message the seller before buying — that conversation stays on MarigoApp and is visible to us if anything later goes wrong.',
      },
      {
        q: 'Can I talk to the seller first?',
        a: 'Yes, and you should. Open the listing and start a conversation to ask about fit, measurements, wear or how soon they can post it. Keeping it in Messages means the exchange is on record.',
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments, prices and fees',
    blurb: 'What you are charged, when, and in which currency.',
    items: [
      {
        q: 'How can I pay?',
        a: 'By card, or with cash on delivery where it is available for your address. Card payments are handled by Stripe — MarigoApp never sees or stores your card number.',
      },
      {
        q: 'When is my card actually charged?',
        a: `Not at checkout. Your card is authorised when you order, which reserves the amount without taking it. The money is only captured and released to the seller after the item is delivered and a short hold has passed — ${DEFAULT_PAYOUT_HOLD_HOURS} hours by default. That gap is your protection: if the order is cancelled or refunded before then, the authorisation is simply released.`,
      },
      {
        q: 'Which currency are prices in?',
        a: 'Prices are stored in euro and shown in Albanian lek by default. You can switch between lek and euro from the menu under your profile picture. The currency you pick changes what you see, not what you are charged — the underlying amount is the same.',
      },
      {
        q: 'What does MarigoApp charge?',
        a: `Buyers pay the listed price plus delivery. Sellers pay a commission of ${commissionPct}% on each sale, so you keep ${sellerKeepsPct}% of the item price. There is no fee to create a listing.`,
      },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery',
    blurb: 'How items travel, and how the fee is worked out.',
    items: [
      {
        q: 'How much is delivery?',
        a: `Delivery is ${DEFAULT_SHIPPING_FEE_ALL} ALL per city an order ships from. If you buy two items from two sellers who are both in Tirana, that is one courier run and one fee. If one is in Tirana and the other in Berat, that is two runs and two fees. Your order summary breaks this down line by line before you pay, so nothing appears at the end that you have not already seen.`,
      },
      {
        q: 'What about deliveries between Albania and Kosovo?',
        a: `Anything crossing the border costs ${CROSS_BORDER_SHIPPING_FEE_ALL} ALL instead of ${DEFAULT_SHIPPING_FEE_ALL}, in either direction, because it is a longer run with a border crossing. It is still charged per origin city, and the international lines are marked as such in your order summary.`,
      },
      {
        q: 'Who actually delivers the item?',
        a: 'A courier collects the parcel from the seller and delivers it to the address on your order, confirming the handover on arrival. You can follow the progress from your order page.',
      },
      {
        q: 'Can I deliver for MarigoApp?',
        a: 'Yes — we are always looking for couriers. There is an application form on the delivery partner page.',
      },
    ],
  },
  {
    id: 'selling',
    title: 'Selling',
    blurb: 'Listing an item and getting paid for it.',
    items: [
      {
        q: 'How do I list something?',
        a: 'Sign in and open Sell. You can either fill the form yourself or hand it to the AI assistant: add your photos and a one-line hint like "Zara black satin dress" and it drafts the listing for you to check. Either way you end up on the same review screen before anything is published.',
      },
      {
        q: 'What do I need to fill in?',
        a: 'Photos, category, description, details (brand, size, condition, colour, material), price, and the address the item ships from. The AI can write the description and suggest a price from the details, and there is a background remover for your photos. Your first photo is the one shoppers see in search, so make it the honest one.',
      },
      {
        q: 'Why does my listing say "pending review"?',
        a: 'New listings are checked before they appear publicly. Once approved the status changes to active and it becomes searchable. You can see the status of everything you have listed under Listings in your profile.',
      },
      {
        q: 'How and when do I get paid?',
        a: `You need to connect a payout account before you can receive money — there is a Stripe onboarding step in your profile. After that, the buyer's payment is released to you once the item is delivered and the ${DEFAULT_PAYOUT_HOLD_HOURS}-hour hold has passed, minus the ${commissionPct}% commission. Your balance and payout history live in your Wallet, and a breakdown of each sale is under Earnings.`,
      },
      {
        q: 'Why does my pickup city matter?',
        a: 'Because delivery is priced by the city an item ships from. The city on the address you choose when publishing is what a buyer is quoted, so picking the right one keeps their total accurate and your parcel on the right courier run.',
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns, refunds and disputes',
    blurb: 'When something is not what you expected.',
    items: [
      {
        q: 'Can I return something?',
        a: `Yes, within ${DEFAULT_REFUND_WINDOW_DAYS} days of delivery. Request the return from your order page, then hand the item back to a courier. Once the seller confirms it has arrived back, the refund is processed.`,
      },
      {
        q: 'The item is not as described. What now?',
        a: 'Open a dispute from the order page. The MarigoApp team reviews what was listed, what arrived and the messages between you, and decides the outcome. This is exactly why conversations and payments should stay on the platform — an off-platform deal leaves us nothing to review.',
      },
      {
        q: 'When do I get my money back?',
        a: 'If the payment was still held in escrow, the authorisation is released and nothing is ever taken. If it had already been captured, the refund goes back to the card it was paid from and appears according to your bank’s own timing.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account and safety',
    blurb: 'Your profile, and staying safe while using it.',
    items: [
      {
        q: 'Do I need separate accounts to buy and sell?',
        a: 'No. One account does both — the moment you list something you are a seller, with nothing extra to sign up for.',
      },
      {
        q: 'I forgot my password.',
        a: 'Use the "Forgot password" link on the sign-in screen and we will email you a reset link.',
      },
      {
        q: 'How do I keep myself safe?',
        a: 'Keep every conversation and every payment on MarigoApp. Never share bank details, card numbers, passwords or one-time codes — MarigoApp staff will never ask you for them. If someone pushes you to pay outside the platform, that is exactly the moment to stop: paying off-platform removes every protection described on this page.',
      },
      {
        q: 'Which countries can I use MarigoApp in?',
        a: 'Delivery addresses currently cover Albania and Kosovo, including deliveries between the two.',
      },
    ],
  },
];
