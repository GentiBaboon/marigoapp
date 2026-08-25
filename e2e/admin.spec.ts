import { test, expect } from '@playwright/test';

/**
 * The property under test is "an unauthenticated visitor never reaches the
 * admin panel" — not the specific way they are turned away, which depends on
 * deployment config.
 *
 * With ADMIN_UNLOCK_PATH + ADMIN_GATE_SECRET set, `/admin` answers **404**:
 * the masked gate (src/lib/admin-gate.ts) runs before the auth redirect,
 * because bouncing to `/auth/login?redirect=/admin` would advertise the panel
 * as loudly as a 403 would. With the gate switched off — CI builds with
 * placeholder env, and it is optional by design — the auth redirect answers
 * instead. Asserting on only one of those makes the suite depend on whether a
 * .env.local happens to exist.
 */
test.describe('Admin Access (unauthenticated)', () => {
  const adminRoutes = [
    '/admin',
    '/admin/products',
    '/admin/refunds',
    '/admin/disputes',
    '/admin/returns',
  ];

  for (const route of adminRoutes) {
    test(`visiting ${route} never reveals the admin panel`, async ({ page }) => {
      const response = await page.goto(route);

      if (response?.status() === 404) {
        // Gate on. Nothing may hint that the route is real and merely locked.
        const body = (await page.content()).toLowerCase();
        expect(body).not.toContain('mg_gate');
        expect(body).not.toContain('dashboard');
        expect(page.url()).not.toContain('/auth/login');
      } else {
        // Gate off — the cookie-presence auth gate turns them away instead.
        await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
        expect(page.url()).toContain('/auth/login');
      }

      // Either way, no admin chrome rendered.
      await expect(page.locator('nav', { hasText: 'Activity Logs' })).toHaveCount(0);
    });
  }

  test('admin pages are never indexable', async ({ page }) => {
    // robots.txt already disallows /admin, but a disallowed URL can still be
    // indexed from an inbound link — only a header on a page the crawler may
    // fetch actually removes it.
    const response = await page.goto('/admin');
    const robots = response?.headers()['x-robots-tag'];
    if (response?.status() !== 404) {
      expect(robots).toContain('noindex');
    }
  });
});
