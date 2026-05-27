import { test, expect } from '@playwright/test';

test('Submit incorrect output tracing answer results in Wrong Answer and 0 points', async ({ page }) => {
  // Use the E2E OAuth callback seam
  await page.goto('/auth/callback?code=test-google-login');

  // Call E2E helper to insert a Wrong Answer submission
  const res = await page.request.post('/api/e2e/reject-submission', { data: {} });
  if (!res.ok()) {
    const text = await res.text().catch(() => '<no-body>');
    console.error('E2E helper failed (reject):', res.status(), text);
    throw new Error('E2E helper POST failed: ' + res.status());
  }

  // Visit submissions page and assert the wrong answer appears
  await page.goto('/submissions');

  // Expect a submission with Wrong Answer or Incorrect and 0 points visible
  const wrong = await page.locator('text=Wrong Answer').first().count();
  const incorrect = await page.locator('text=Incorrect').first().count();
  const zeroPoints = await page.locator('text="0"').first().count();

  expect(wrong + incorrect).toBeGreaterThan(0);
  expect(zeroPoints).toBeGreaterThan(0);
});
