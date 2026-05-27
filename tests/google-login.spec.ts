import { expect, test } from '@playwright/test';

test('Google login redirects through OAuth callback to the student dashboard', async ({ page }) => {
  let capturedAuthorizeUrl = '';

  await page.route('**/auth/v1/authorize**', async (route) => {
    capturedAuthorizeUrl = route.request().url();

    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body>OAuth start captured for test.</body></html>',
    });
  });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await page.getByRole('button', { name: 'Google' }).click();

  await expect.poll(() => capturedAuthorizeUrl).toContain('/auth/v1/authorize');

  const authorizeRequest = new URL(capturedAuthorizeUrl);
  expect(authorizeRequest.searchParams.get('provider')).toBe('google');
  expect(authorizeRequest.searchParams.get('redirect_to')).toContain('/auth/callback');

  await page.goto('/auth/callback?code=test-google-login');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Welcome back, Test Student!' })).toBeVisible();
});