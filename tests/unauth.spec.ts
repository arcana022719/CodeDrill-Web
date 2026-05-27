import { test, expect } from '@playwright/test';

test('Unauthenticated /problems redirects to /login', async ({ page }) => {
  await page.goto('/problems');

  // Exact redirect to the login page
  await expect(page).toHaveURL('http://localhost:3000/login');

  // Login UI visible
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  // Ensure protected page content is not shown
  await expect(page.getByRole('heading', { name: 'Problem Browser' })).not.toBeVisible();
});

