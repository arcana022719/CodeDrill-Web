import { test, expect } from '@playwright/test';

test('Fill-in-the-blanks exact match (case-insensitive) marked correct', async ({ page }) => {
  await page.goto('/auth/callback?code=test-google-login');

  const res = await page.request.post('/api/e2e/fillmatch-submission', { data: { answer: 'TeXt' } });
  if (!res.ok()) {
    const text = await res.text().catch(() => '<no-body>');
    console.error('E2E helper failed (fillmatch):', res.status(), text);
    throw new Error('E2E helper POST failed: ' + res.status());
  }

  const body = await res.json();
  expect(body.success).toBeTruthy();

  // Visit submissions page and expect Accepted present
  await page.goto('/submissions');
  const accepted = await page.locator('text=Accepted').first().count();
  expect(accepted).toBeGreaterThan(0);
});
