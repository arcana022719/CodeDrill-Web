import { test, expect } from '@playwright/test';

test('Achievement badge awarded after 7-day streak and appears on leaderboard', async ({ page }) => {
  await page.goto('/auth/callback?code=test-google-login');

  const res = await page.request.post('/api/e2e/streak-badge', {
    data: { streakDays: 7 },
  });

  if (!res.ok()) {
    const text = await res.text().catch(() => '<no-body>');
    console.error('E2E helper failed (streak badge):', res.status(), text);
    throw new Error('E2E helper POST failed: ' + res.status());
  }

  const body = await res.json();
  expect(body.success).toBeTruthy();
  expect(body.badgeAwarded).toBe(true);
  expect(body.onLeaderboard).toBe(true);
  expect(body.consistentOnLeaderboard).toBe(true);
});
