import { test, expect } from '@playwright/test';

test('RLS: student cannot read another student answers (0 rows)', async ({ page }) => {
  await page.goto('/auth/callback?code=test-google-login');

  const res = await page.request.get('/api/e2e/rls-cross-student-answers');
  if (!res.ok()) {
    const text = await res.text().catch(() => '<no-body>');
    console.error('E2E helper failed (RLS):', res.status(), text);
    throw new Error('E2E helper GET failed: ' + res.status());
  }

  const body = await res.json();
  expect(body.success).toBeTruthy();
  expect(body.rowCount).toBe(0);
});
