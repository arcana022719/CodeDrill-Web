import { test, expect } from '@playwright/test';

test('Essay submission is flagged for manual review with manually_reviewed = false', async ({ page }) => {
  await page.goto('/auth/callback?code=test-google-login');

  const res = await page.request.post('/api/e2e/essay-submission', { data: { answer: 'This is an E2E essay answer.' } });
  if (!res.ok()) {
    const text = await res.text().catch(() => '<no-body>');
    console.error('E2E helper failed (essay):', res.status(), text);
    throw new Error('E2E helper POST failed: ' + res.status());
  }

  const body = await res.json();
  expect(body.success).toBeTruthy();
  expect(body.manuallyReviewed).toBe(false);

  // Visit submissions history and expect a Pending Review entry
  await page.goto('/submissions/history');
  const pending = await page.locator('text=Pending Review').first().count();
  expect(pending).toBeGreaterThan(0);
});
