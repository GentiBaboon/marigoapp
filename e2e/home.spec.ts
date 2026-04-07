import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with "marigo" header text', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header.getByText('marigo')).toBeVisible();
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
    // Use exact text match to avoid strict mode violation
    await expect(footer.locator('h3', { hasText: 'marigo' })).toBeVisible();
  });
});
