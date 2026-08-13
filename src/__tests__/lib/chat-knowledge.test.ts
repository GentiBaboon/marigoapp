import { describe, it, expect } from 'vitest';
import {
  sanitizeChatLinks,
  detectChatLanguage,
  KNOWN_ROUTES,
  PLATFORM_KNOWLEDGE,
  ALLOWED_LINK_PREFIXES,
} from '@/lib/chat-knowledge';

/**
 * The chatbot's links are chosen by an LLM, which means they are untrusted
 * input: a hallucination or a prompt-injected product title could otherwise
 * put an off-site URL in front of a visitor as a tappable button.
 */
describe('sanitizeChatLinks', () => {
  it('keeps known site-relative routes', () => {
    expect(
      sanitizeChatLinks([
        { label: 'Start selling', href: '/sell' },
        { label: 'Sign up', href: '/auth/signup' },
      ]),
    ).toEqual([
      { label: 'Start selling', href: '/sell' },
      { label: 'Sign up', href: '/auth/signup' },
    ]);
  });

  it('keeps product and filtered-search links', () => {
    const links = sanitizeChatLinks([
      { label: 'View', href: '/products/draft_123' },
      { label: 'All ZARA', href: '/search?brand=zara&gender=women' },
    ]);
    expect(links).toHaveLength(2);
  });

  it.each([
    ['absolute off-site', 'https://evil.com/steal'],
    ['protocol-relative', '//evil.com'],
    ['javascript url', 'javascript:alert(1)'],
    ['backslash bypass', '/\\evil.com'],
    ['unknown route', '/admin/finance'],
    ['bare word', 'sell'],
  ])('drops %s', (_label, href) => {
    expect(sanitizeChatLinks([{ label: 'Tap me', href }])).toEqual([]);
  });

  it('drops entries missing a label or href', () => {
    expect(
      sanitizeChatLinks([
        { label: '', href: '/sell' },
        { label: 'No href', href: '' },
      ] as any),
    ).toEqual([]);
  });

  it('de-duplicates repeated destinations', () => {
    expect(
      sanitizeChatLinks([
        { label: 'Sell', href: '/sell' },
        { label: 'Start selling', href: '/sell' },
      ]),
    ).toEqual([{ label: 'Sell', href: '/sell' }]);
  });

  it('caps the number of buttons', () => {
    const many = [
      { label: 'a', href: '/sell' },
      { label: 'b', href: '/cart' },
      { label: 'c', href: '/help' },
      { label: 'd', href: '/about' },
    ];
    expect(sanitizeChatLinks(many)).toHaveLength(3);
    expect(sanitizeChatLinks(many, 2)).toHaveLength(2);
  });

  it('tolerates a missing or malformed array', () => {
    expect(sanitizeChatLinks(undefined)).toEqual([]);
    expect(sanitizeChatLinks(null as any)).toEqual([]);
    expect(sanitizeChatLinks([null, undefined] as any)).toEqual([]);
  });
});

/**
 * Regression cover for a real failure: asking the model to mirror the user's
 * language sent the English "how can I sell?" back in Albanian, because the
 * surrounding prompt is full of Albanian. Detection is deterministic now.
 */
describe('detectChatLanguage', () => {
  it.each([
    'how can I sell?',
    'Hello',
    'is there anything from zara?',
    'what are the shipping costs',
    'I want to buy a bag',
    'do you have any Balenciaga?',
  ])('reads %j as English', (message) => {
    expect(detectChatLanguage(message)).toBe('en');
  });

  it.each([
    'a keni ndonje gje nga zara?',
    'Si mund të shes një çantë?',
    'Përshëndetje',
    'sa eshte cmimi',
    'dua te blej dicka',
    'faleminderit shume',
  ])('reads %j as Albanian', (message) => {
    expect(detectChatLanguage(message)).toBe('sq');
  });

  it('treats the Albanian-only diacritics as decisive', () => {
    // Even wrapped in English function words, ë/ç mean the visitor is writing
    // Albanian — usually a brand plus one Albanian word.
    expect(detectChatLanguage('çanta')).toBe('sq');
    expect(detectChatLanguage('a keni gjë të re?')).toBe('sq');
  });

  it('falls back to the UI locale when the message carries no signal', () => {
    // "Gucci?" is the same word in both languages.
    expect(detectChatLanguage('Gucci?', 'sq')).toBe('sq');
    expect(detectChatLanguage('Gucci?', 'en')).toBe('en');
    expect(detectChatLanguage('', 'sq')).toBe('sq');
    expect(detectChatLanguage('42')).toBe('en');
  });

  it('ignores words that exist in both languages', () => {
    // "a" and "me" are Albanian words but also English ones; alone they must
    // not outvote the locale.
    expect(detectChatLanguage('a me', 'en')).toBe('en');
  });
});

describe('knowledge base', () => {
  it('only cites routes that are on the allow-list', () => {
    // Guards against the knowledge prose drifting to a route the sanitizer
    // would then strip, which would silently drop the assistant's links.
    const cited = PLATFORM_KNOWLEDGE.match(/\s\/[a-z0-9/_-]+/gi) ?? [];
    const unknown = cited
      .map((c) => c.trim())
      .filter((path) => !ALLOWED_LINK_PREFIXES.some((p) => path === p || path.startsWith(p)));
    expect(unknown).toEqual([]);
  });

  it('exposes the auth routes the signed-out flow depends on', () => {
    expect(KNOWN_ROUTES.signup).toBe('/auth/signup');
    expect(KNOWN_ROUTES.login).toBe('/auth/login');
    expect(KNOWN_ROUTES.sell).toBe('/sell');
  });
});
