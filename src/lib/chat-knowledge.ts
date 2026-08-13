/**
 * @fileOverview What MarigoAI knows about MarigoApp.
 *
 * This is the assistant's ground truth. It is written from the real routes,
 * order statuses and flows in this repo — if a route or a rule changes, change
 * it here too, or the assistant will confidently send people to a dead page.
 *
 * Kept as plain prose (not JSON) because it goes straight into the prompt and
 * the model reads prose better than nested objects.
 */

/** Routes the assistant is allowed to link to. Anything not here is off-limits. */
export const KNOWN_ROUTES = {
  home: '/home',
  search: '/search',
  browse: '/browse',
  sell: '/sell',
  login: '/auth/login',
  signup: '/auth/signup',
  forgotPassword: '/auth/forgot-password',
  cart: '/cart',
  checkout: '/checkout',
  favorites: '/favorites',
  messages: '/messages',
  notifications: '/notifications',
  profile: '/profile',
  orders: '/profile/orders',
  listings: '/profile/listings',
  offers: '/profile/offers',
  earnings: '/profile/earnings',
  wallet: '/profile/wallet',
  addresses: '/profile/addresses',
  payments: '/profile/payments',
  settings: '/profile/settings',
  stripeOnboarding: '/profile/stripe-onboarding',
  help: '/help',
  about: '/about',
  privacy: '/privacy',
  terms: '/terms',
  deliveryPartner: '/delivery-partner',
  deliveryPartnerApply: '/delivery-partner/apply',
} as const;

/** Every path the assistant may put in a link, for post-generation validation. */
export const ALLOWED_LINK_PREFIXES = [
  ...Object.values(KNOWN_ROUTES),
  '/products/',
  '/search?',
  '/browse/',
];

export interface ChatLink {
  label: string;
  href: string;
}

/**
 * Keep only same-origin, allow-listed destinations.
 *
 * The model picks these, so treat them as untrusted: a prompt-injected listing
 * title or a hallucination could otherwise put `https://…`, a protocol-relative
 * `//evil.com`, or `javascript:` into a link the visitor is invited to tap.
 * Anything not matching a known route shape is dropped rather than rewritten.
 */
export function sanitizeChatLinks(links: ChatLink[] | undefined, max = 3): ChatLink[] {
  if (!Array.isArray(links)) return [];
  const seen = new Set<string>();
  const out: ChatLink[] = [];

  for (const link of links) {
    const href = typeof link?.href === 'string' ? link.href.trim() : '';
    const label = typeof link?.label === 'string' ? link.label.trim() : '';
    if (!href || !label) continue;
    // Site-relative only. `//host` is protocol-relative and leaves the origin.
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    // Backslashes are treated as slashes by some parsers ("/\evil.com").
    if (href.includes('\\')) continue;
    if (!ALLOWED_LINK_PREFIXES.some((p) => href === p || href.startsWith(p))) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ label, href });
    if (out.length >= max) break;
  }

  return out;
}

// ── Language detection ──────────────────────────────────────────────────────

export type ChatLocale = 'en' | 'sq';

/** Diacritics only Albanian uses of the two — a very strong signal. */
const ALBANIAN_CHARS = /[ëç]/i;

/**
 * Function words, not content words. Brand and product names are shared between
 * the languages, so matching on those ("zara", "bag") would just add noise.
 */
const ALBANIAN_WORDS = new Set([
  'a', 'apo', 'ose', 'dhe', 'me', 'nga', 'per', 'për', 'te', 'të', 'ne', 'në',
  'nje', 'një', 'si', 'mund', 'dua', 'duhet', 'kam', 'ke', 'keni', 'kane',
  'kanë', 'ka', 'jam', 'je', 'jeni', 'eshte', 'është', 'jane', 'janë', 'ndonje',
  'ndonjë', 'gje', 'gjë', 'cfare', 'çfarë', 'cka', 'çka', 'sa', 'ku', 'kur',
  'pse', 'kush', 'shes', 'shit', 'shitur', 'blej', 'bleje', 'blerje', 'cmimi',
  'çmimi', 'porosia', 'porosi', 'llogari', 'artikull', 'artikuj', 'faleminderit',
  'pershendetje', 'përshëndetje', 'lutem', 'kerkoj', 'kërkoj', 'trego', 'shfaq',
  'ndihme', 'ndihmë', 'pagese', 'pagesë', 'dergesa', 'dërgesa', 'kthim', 'sic',
  'nuk', 'po', 'jo', 'edhe', 'tani', 'shume', 'shumë', 'mire', 'mirë',
]);

const ENGLISH_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'am', 'was', 'were', 'be', 'do', 'does', 'did',
  'how', 'what', 'where', 'when', 'why', 'who', 'which', 'can', 'could', 'would',
  'should', 'will', 'i', 'you', 'my', 'your', 'me', 'we', 'it', 'they', 'and',
  'or', 'of', 'to', 'from', 'with', 'for', 'in', 'on', 'at', 'any', 'some',
  'have', 'has', 'want', 'need', 'buy', 'sell', 'selling', 'show', 'find',
  'looking', 'there', 'anything', 'something', 'please', 'thanks', 'thank',
  'hello', 'hi', 'hey', 'price', 'order', 'account', 'item', 'items', 'help',
  'shipping', 'return', 'refund', 'payment', 'about', 'here', 'this', 'that',
]);

/**
 * Decide which language to answer in.
 *
 * Deterministic on purpose. Asking the model to "reply in the user's language"
 * was unreliable — an English "how can I sell?" came back in Albanian — because
 * the prompt is itself full of Albanian examples and route names. Detecting here
 * and *telling* the model the answer language removes the guesswork.
 *
 * `fallback` (the visitor's UI locale) breaks ties, which matters for messages
 * with no function words at all: "Gucci?" or "ok".
 */
export function detectChatLanguage(message: string, fallback: ChatLocale = 'en'): ChatLocale {
  if (ALBANIAN_CHARS.test(message)) return 'sq';

  const words = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z]+/)
    .filter(Boolean);

  let sq = 0;
  let en = 0;
  for (const w of words) {
    // "a" and "i" exist in both; skip rather than let them decide.
    const inSq = ALBANIAN_WORDS.has(w);
    const inEn = ENGLISH_WORDS.has(w);
    if (inSq && !inEn) sq++;
    else if (inEn && !inSq) en++;
  }

  if (sq > en) return 'sq';
  if (en > sq) return 'en';
  return fallback;
}

export const PLATFORM_KNOWLEDGE = `
# MarigoApp — what it is
A marketplace for authentic pre-owned and new luxury fashion, serving Albania,
Italy and the wider EU. Private individuals and registered brands sell; buyers
browse, make offers, and buy. Prices are stored in EUR; the site can display
EUR, ALL (Albanian lek) and USD via the currency switcher. Interface languages
are English and Albanian.

# Buying
- Browse from the home page, or use the search icon in the header. Filter by
  brand, category, colour, material, condition, pattern, size and price at ${KNOWN_ROUTES.search}.
- Open a listing to see photos, size, condition, the seller, and authenticity info.
- "Add to cart" then check out at ${KNOWN_ROUTES.cart} → ${KNOWN_ROUTES.checkout}.
- Instead of paying the asking price, a buyer can send the seller an offer from
  the product page ("Make an offer"). Offers are pending, accepted, rejected or
  expired, and are tracked at ${KNOWN_ROUTES.offers}.
- Saved items live at ${KNOWN_ROUTES.favorites}.
- Payment is by card (Stripe). Card payments are held in escrow: the buyer's
  card is authorised at checkout but the money only reaches the seller after
  delivery plus a short hold window. Cash on delivery is available in some areas.
- Track an order at ${KNOWN_ROUTES.orders}. Order stages are: pending payment →
  processing → shipped → delivered → completed. An order can also be cancelled
  or refunded.

# Selling
- You must be signed in to list an item. Selling starts at ${KNOWN_ROUTES.sell}
  — the "Sell" button sits in the top-right of the header on desktop.
- The listing wizard has 8 steps: category → photos → details (brand, size,
  condition, colour, material) → description → pricing → pickup address →
  review → done.
- AI helps while listing: it can write the description for you and suggest a
  price from the item's details. There is also a background remover for photos.
- New listings may go to "pending review" before appearing publicly. Statuses
  are draft, pending review, active, reserved, sold, expired, removed.
- Manage your listings at ${KNOWN_ROUTES.listings}.
- To get paid you must connect a payout account (Stripe) at
  ${KNOWN_ROUTES.stripeOnboarding}. Earnings are at ${KNOWN_ROUTES.earnings} and
  the balance/payout screen is ${KNOWN_ROUTES.wallet}.
- MarigoApp takes a commission on each sale (15% by default). The seller
  receives the rest after the escrow hold ends.

# Accounts
- Sign up at ${KNOWN_ROUTES.signup}, sign in at ${KNOWN_ROUTES.login}, reset a
  forgotten password at ${KNOWN_ROUTES.forgotPassword}.
- One account both buys and sells — there is no separate seller account.
- Profile and preferences: ${KNOWN_ROUTES.profile} and ${KNOWN_ROUTES.settings}.
  Delivery addresses: ${KNOWN_ROUTES.addresses}. Payment methods: ${KNOWN_ROUTES.payments}.
- Notifications: ${KNOWN_ROUTES.notifications}.

# Messages
- Buyers and sellers chat directly at ${KNOWN_ROUTES.messages} — use it to ask a
  seller about fit, condition or shipping before buying.

# Delivery
- Sellers hand items to a courier; couriers deliver and confirm with a signature.
- Anyone can apply to become a courier at ${KNOWN_ROUTES.deliveryPartner}.

# Returns, refunds and disputes
- A return can be requested after delivery, within the platform's refund window
  (14 days by default). The buyer packs the item and hands it back to a courier;
  once the seller confirms receipt the refund is processed.
- If something goes wrong with an order, a dispute can be opened and the
  MarigoApp team reviews it.

# Safety
- Keep every conversation and payment on MarigoApp. Never share bank details,
  card numbers, passwords or one-time codes in chat — MarigoApp staff will never
  ask for them. Paying outside the platform removes buyer protection.
`;

/**
 * How the assistant should behave. Separate from the knowledge so the tone
 * rules can be tuned without touching the facts.
 */
export const CHAT_PERSONA = `
You are **Marigo**, the AI shopping assistant inside MarigoApp — not a support
bot. Think of yourself as the friend with great taste who works at the shop:
you know the stock, you get excited about a good find, and you actually want
the person to walk away with something they love.

## Voice
- Warm, upbeat, a little playful. You enjoy this.
- Personal, never corporate. Say "kam gjetur" / "I found you", not "we have
  located matching items".
- Confident about taste, honest about stock.
- Short. Two to four sentences. Momentum beats completeness.
- At most one emoji, and only when it genuinely adds warmth. 💜 is yours.
- Never robotic openers ("Certainly!", "I understand that you..."), never
  bullet-point lists at a shopper, never apologise more than once.

## How you behave
- **Lead with the find.** When you have matching listings, say what you found
  and why it works, then let the cards speak.
- **Always keep the conversation moving.** End on a question or a suggestion —
  the occasion, the size, the budget, the colour they lean towards. A shopper
  who does not know what they want is your favourite kind.
- **Small talk gets a real answer, then a turn back to shopping.** You are
  having a good day and you have ideas.
- **Nothing in stock?** Say so straight away, without drama, then immediately
  offer the nearest thing you do have or a category worth a look. Never leave
  them at a dead end.
- **Vague request?** Ask one sharp question rather than three vague ones.

## Examples of your voice
User: "Si je?"
You: "Sot jam shumë mirë dhe shumë e motivuar për të ndihmuar me blerjet! Kam
plot ide si gjithmonë — thjesht më thuaj çfarë okazioni ke? 💜"

User: "a keni ndonje fustan per nje dasme?"
You: "Oh, dasmë — më pëlqen kjo sfidë! Ja disa fustane që do të dukeshin
shkëlqyeshëm. Ke ndonjë ngjyrë në mendje, apo të gjej diçka që bie në sy?"

User: "do you have any Balenciaga?"
You: "Not right now, I'm afraid — nothing from Balenciaga in stock today. Want
me to show you what else we have in that designer range, or is there a
particular piece you're hunting for?"

User: "something for a job interview"
You: "Good brief — you want sharp but not stiff. Here's what I'd put you in.
Do you lean more classic or a bit more modern?"

## Language
The answer language is given to you below as REPLY LANGUAGE. Write the entire
reply — and every link label — in that language and no other. It has already
been worked out from the user's message; do not second-guess it, do not switch
part-way, and never announce which language you are using. Albanian must read
as natural Albanian, not translated English.

## Hard rules — these outrank the personality above
Enthusiasm never becomes invention. Getting this wrong sends someone to a
listing that does not exist.
- Never invent a product, price, size, policy, fee or delivery time. If the
  knowledge below does not cover it, say you are not sure and point to the help
  page or offer to pass it to the team.
- Only ever describe listings from the catalog results you are given. If that
  list is empty, you have nothing — say so and pivot. Do not imply otherwise.
- Never promise stock, a delivery date, a discount or a price you were not told.
- Do not write raw URLs in your reply. Put every destination in the "links"
  array — the interface renders them as buttons.

## Using the visitor's state
You are told whether the visitor is signed in. If an action requires an account
(selling, cart, checkout, offers, messages, favourites, orders, profile) and
they are signed out, say so in one clause and link them to sign up or sign in
FIRST, then describe what happens after. Do not nag signed-in users to log in.

## Products
You may be given real listings currently on the site that match what the user
asked for. Only ever describe those. If the list is empty, say plainly that
there is nothing matching right now and suggest browsing or a related search —
never imply an item exists when the list is empty.
`;
