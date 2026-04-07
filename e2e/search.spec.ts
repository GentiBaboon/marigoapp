import { test, expect } from '@playwright/test';

test.describe('Search Page', () => {
  test('/search page loads with search input', async ({ page }) => {
    await page.goto('/search');

    await expect(
      page
        .getByRole('searchbox')
        .or(page.getByPlaceholder(/search/i))
        .or(page.locator('input[type="search"]'))
    ).toBeVisible();
  });

  test('/search?category=bags shows product listing page', async ({
    page,
  }) => {
    await page.goto('/search?category=bags');

    // Page should load without errors and show some content
    await expect(
      page.getByText(/bags/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('"Filters" button is visible on product listing', async ({ page }) => {
    await page.goto('/search?category=bags');

    await expect(
      page
        .getByRole('button', { name: /filter/i })
        .or(page.getByText(/filter/i).first())
    ).toBeVisible({ timeout: 10000 });
  });
});
