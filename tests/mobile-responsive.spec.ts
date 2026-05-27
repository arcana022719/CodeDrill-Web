import { test, expect } from '@playwright/test';

test('Mobile responsive layout at 375px shows hamburger and keeps layout intact', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/auth/callback?code=test-google-login&next=/');

  // Hamburger button should be visible on mobile.
  const hamburger = page.locator('header button[class*="md:hidden"]').first();
  await expect(hamburger).toBeVisible();

  await hamburger.click();
  await expect(page.locator('div.md\\:hidden a:has-text("Dashboard")').first()).toBeVisible();

  // Basic responsive integrity: no horizontal overflow on 375px viewport.
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasOverflow).toBe(false);
});
