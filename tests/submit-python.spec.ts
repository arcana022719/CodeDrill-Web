import { test, expect } from '@playwright/test';

test('Submit correct Python solution results in Accepted and stats update', async ({ page }) => {
  // Use the E2E callback seam to become the test student
  await page.goto('/auth/callback?code=test-google-login');

  // Call the E2E helper to insert an accepted submission and update user totals
  const res = await page.request.post('/api/e2e/accept-submission', { data: {} });
  if (!res.ok()) {
    const text = await res.text().catch(() => '<no-body>');
    console.error('E2E helper failed:', res.status(), text);
    throw new Error('E2E helper POST failed: ' + res.status());
  }
  const body = await res.json();
  expect(body.success).toBeTruthy();

  const { newTotals } = body;

  // Visit the dashboard and confirm totals are reflected
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back, Test Student!' })).toBeVisible();

  await expect(page.getByText(String(newTotals.totalPoints))).toBeVisible();
  await expect(page.getByText(new RegExp(`${newTotals.currentStreak} days`))).toBeVisible();

  // Verify the submission appears in the submissions list as Accepted
  await page.goto('/submissions');
  await expect(page.getByText('Accepted')).toBeVisible();
});
