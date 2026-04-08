import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('login page loads with email and password fields', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('signup page loads with name, email, and password fields', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.getByLabel(/name/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    // Terms text exists on the page
    await expect(page.getByText(/accept terms/i).first()).toBeVisible();
  });

  test('forgot password page loads with email field', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Send Reset Link')).toBeVisible();
  });

  test('unauthenticated user visiting /profile is redirected to /auth/login', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/auth/login');
  });

  test('unauthenticated user visiting /admin is redirected to /auth/login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/auth/login');
  });
});
