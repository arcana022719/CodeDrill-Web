import { test, expect } from '@playwright/test';

test('Student toggles leaderboard visibility off and disappears from leaderboard', async ({ page }) => {
  await page.goto('/auth/callback?code=test-google-login');

  const res = await page.request.post('/api/e2e/leaderboard-visibility', {
    data: { visible: false },
  });

  if (!res.ok()) {
    const text = await res.text().catch(() => '<no-body>');
    console.error('E2E helper failed (leaderboard visibility):', res.status(), text);
    throw new Error('E2E helper POST failed: ' + res.status());
  }

  const body = await res.json();
  expect(body.success).toBeTruthy();
  expect(body.visibility).toBe(false);
  expect(body.presentOnLeaderboard).toBe(false);
});
