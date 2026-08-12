import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with the marigo logo in the header', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();
    // The wordmark is an <Image>, not text. Matched by attribute rather than
    // getByRole: the shopping-preference modal opens on a first visit and
    // Radix marks the rest of the page aria-hidden, so role-based locators
    // find nothing behind it.
    await expect(header.locator('img[alt="Marigo"]')).toBeVisible();
  });

  test('"Shop by Category" section is visible', async ({ page }) => {
    await expect(page.getByText(/shop by category/i)).toBeVisible();
  });

  test('header navigation contains links', async ({ page }) => {
    // Desktop viewport shows header links like Womenswear, Menswear, Bags, Shoes
    const header = page.locator('header');
    await expect(header).toBeVisible();
    // At least the search icon and Sign In should be in header
    await expect(header.getByText('Sign In')).toBeVisible();
  });

  test('"Sign In" link is visible for unauthenticated users', async ({ page }) => {
    await expect(page.getByText('Sign In').first()).toBeVisible();
  });

  test('page has correct title containing "MarigoApp"', async ({ page }) => {
    await expect(page).toHaveTitle(/MarigoApp/i);
  });

  test('footer is visible', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    // Same as the header: the brand is the logo image, and the column
    // headings are Shop / About / Newsletter.
    await expect(footer.locator('img[alt="Marigo"]')).toBeVisible();
    await expect(footer.locator('h3').filter({ hasText: 'Shop' })).toBeVisible();
  });
});
