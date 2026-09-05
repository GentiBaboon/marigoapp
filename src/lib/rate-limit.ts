/**
 * In-memory sliding-window rate limiter for Next.js API routes.
 *
 * Each limiter instance tracks request counts per key (usually IP).
 * Entries auto-expire after the window elapses.
 *
 * NOTE: This works well for single-instance or Vercel Serverless deployments
 * (each cold start gets a fresh store, which is acceptable because the window
 * is short). For multi-instance deployments, use Redis-backed rate limiting
 * (e.g. @upstash/ratelimit) instead.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // epoch ms
}

interface RateLimitConfig {
  /** Maximum number of requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

/**
 * Create a named rate limiter with the given config.
 * Re-using the same `name` returns the same backing store.
 */
export function createRateLimiter(name: string, config: RateLimitConfig) {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;

  return {
    /**
     * Check and consume one request for `key`.
     * Returns `{ allowed, remaining, resetAt }`.
     */
    check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
      const now = Date.now();
      const entry = store.get(key);

      // Purge stale entries lazily (every 100 calls)
      if (Math.random() < 0.01) {
        for (const [k, v] of store) {
          if (v.resetAt <= now) store.delete(k);
        }
      }

      if (!entry || entry.resetAt <= now) {
        // First request in this window
        const resetAt = now + config.windowSeconds * 1000;
        store.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: config.limit - 1, resetAt };
      }

      if (entry.count >= config.limit) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
      }

      entry.count++;
      return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
    },
  };
}

// ── Pre-configured limiters for each API route ──────────────────────────────

/** Forgot password: 5 requests per 15 minutes per IP */
export const forgotPasswordLimiter = createRateLimiter('forgot-password', {
  limit: 5,
  windowSeconds: 15 * 60,
});

/** Upload: 30 requests per minute per IP */
export const uploadLimiter = createRateLimiter('upload', {
  limit: 30,
  windowSeconds: 60,
});

/** Create order: 10 requests per minute per IP */
export const createOrderLimiter = createRateLimiter('create-order', {
  limit: 10,
  windowSeconds: 60,
});

/** Create payment intent: 10 requests per minute per IP */
export const paymentIntentLimiter = createRateLimiter('payment-intent', {
  limit: 10,
  windowSeconds: 60,
});

/** Start conversation: 20 requests per minute per IP */
export const conversationLimiter = createRateLimiter('conversation', {
  limit: 20,
  windowSeconds: 60,
});

/** Offer notifications: 30 per minute per IP. A negotiation is a handful of
 *  actions, so this only ever catches a loop or an abuser. */
export const offerLimiter = createRateLimiter('offer', {
  limit: 30,
  windowSeconds: 60,
});

/** Send an activation code: 5 per 15 minutes per IP. Each one costs an email,
 *  and a legitimate signup needs one. */
export const otpSendLimiter = createRateLimiter('otp-send', {
  limit: 5,
  windowSeconds: 15 * 60,
});

/**
 * Submit an activation code: 15 per 10 minutes per IP.
 *
 * This is the *primary* brute-force control, not the per-account attempt
 * counter beside it. The counter lives in a document the account owner can
 * write — the server reaches Firestore with the user's own token and has no
 * privilege the user lacks (see `src/lib/otp.ts`) — so a determined owner can
 * reset it. They cannot reset this: it is process memory, keyed by IP, and
 * nothing user-controlled touches it. At 15 guesses per window against 10^6
 * codes that expire in 10 minutes, guessing is not a strategy.
 */
export const otpVerifyLimiter = createRateLimiter('otp-verify', {
  limit: 15,
  windowSeconds: 10 * 60,
});

/**
 * The AI routes — the most expensive thing an anonymous caller can reach.
 *
 * These are unauthenticated by design (the chatbot must answer signed-out
 * visitors; the description and recommendation helpers are stateless), and
 * they were also unlimited, which made them a quota-exhaustion vector rather
 * than merely a cost one. The Google AI free tier 429s at roughly 20 requests
 * (`generate_content_free_tier_requests`), and CLAUDE.md §13 records what that
 * looks like from the outside: chat degrades to canned retrieval-only copy
 * while pricing, descriptions and smart-search fail outright. A single script
 * could take all of that down for every real visitor, for free.
 *
 * Budgets are per IP and sized to the honest use of each route, not to the
 * model's price. Generous enough for a shared NAT, mean enough for a loop.
 */
export const chatLimiter = createRateLimiter('ai-chat', {
  limit: 40,
  windowSeconds: 10 * 60,
});

/** Listing copy: a seller regenerates a few times per listing. */
export const aiDescriptionLimiter = createRateLimiter('ai-description', {
  limit: 15,
  windowSeconds: 10 * 60,
});

/** Homepage recommendations. Already cached per session, so a legitimate
 *  visitor spends one of these per taste profile, not one per page view. */
export const aiRecommendationsLimiter = createRateLimiter('ai-recommendations', {
  limit: 30,
  windowSeconds: 10 * 60,
});

/** Image generation — the priciest call in the app, and the slowest. */
export const aiImageLimiter = createRateLimiter('ai-image', {
  limit: 10,
  windowSeconds: 10 * 60,
});

/** Multimodal draft-listing: nine photos in, a whole form out. Token-gated
 *  already, so this only stops a signed-in account draining the quota. */
export const aiDraftListingLimiter = createRateLimiter('ai-draft-listing', {
  limit: 10,
  windowSeconds: 10 * 60,
});

/** Price suggestion from photos. Multimodal and token-gated like the draft
 *  assistant, and a seller may reasonably ask more than once while tuning a
 *  price — but not thirty times. */
export const aiPriceSuggestionLimiter = createRateLimiter('ai-price-suggestion', {
  limit: 15,
  windowSeconds: 10 * 60,
});

/** Stripe Connect onboarding. Each call can create a real connected account
 *  at the platform, so an unbounded loop is an abuse problem at Stripe, not
 *  just here. Nobody legitimately onboards twice in a minute. */
export const stripeConnectLimiter = createRateLimiter('stripe-connect', {
  limit: 5,
  windowSeconds: 10 * 60,
});

/** Admin image ingest. Admin-only, so this is a backstop against a runaway
 *  bulk import rather than an attacker. */
export const adminUploadLimiter = createRateLimiter('admin-upload', {
  limit: 60,
  windowSeconds: 60,
});

/**
 * Visitor heartbeats.
 *
 * Sized against the heartbeat interval, not against abuse: one visitor beats
 * roughly every 45s, so a browser tab spends ~14 of these per 10 minutes. The
 * ceiling is high because a shared NAT — an office, a campus, a mobile
 * carrier — legitimately puts many real visitors behind one IP, and throttling
 * them would silently under-count exactly the traffic this feature exists to
 * measure. It still stops a script from filling the store.
 */
export const presenceLimiter = createRateLimiter('presence', {
  limit: 400,
  windowSeconds: 10 * 60,
});

// ── Helper to extract client IP ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

/**
 * Get the client IP from the request. Falls back to 'unknown' if unavailable.
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Apply rate limiting to a request. Returns a 429 response if the limit
 * is exceeded, or null if the request is allowed.
 */
export function applyRateLimit(
  req: NextRequest,
  limiter: ReturnType<typeof createRateLimiter>
): NextResponse | null {
  const ip = getClientIp(req);
  const { allowed, remaining, resetAt } = limiter.check(ip);

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(resetAt).toUTCString(),
        },
      }
    );
  }

  return null; // Request is allowed
}
