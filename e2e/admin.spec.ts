import { test, expect } from '@playwright/test';

test.describe('Admin Access (unauthenticated)', () => {
  const adminRoutes = [
    '/admin',
    '/admin/products',
    '/admin/refunds',
    '/admin/disputes',
    '/admin/returns',
  ];

  for (const route of adminRoutes) {
    test(`visiting ${route} redirects to /auth/login`, async ({ page }) => {
      await page.goto(route);

      await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
      expect(page.url()).toContain('/auth/login');
    });
  }
});
