import { test, expect } from '@playwright/test';

test('Professor grades essay and feedback persists with manually_reviewed=true', async ({ page }) => {
  await page.goto('/auth/callback?code=test-google-login');

  // Step 1: create a pending essay submission using existing E2E helper
  const createRes = await page.request.post('/api/e2e/essay-submission', {
    data: { answer: 'Essay answer to be graded in TC-07.' },
  });
  if (!createRes.ok()) {
    const text = await createRes.text().catch(() => '<no-body>');
    console.error('E2E helper failed (essay create):', createRes.status(), text);
    throw new Error('E2E helper POST failed: ' + createRes.status());
  }

  // Step 2: grade it and verify persisted fields
  const gradeRes = await page.request.post('/api/e2e/grade-essay', {
    data: { pointsAwarded: 7, feedback: 'Solid argument and examples.' },
  });
  if (!gradeRes.ok()) {
    const text = await gradeRes.text().catch(() => '<no-body>');
    console.error('E2E helper failed (essay grade):', gradeRes.status(), text);
    throw new Error('E2E helper POST failed: ' + gradeRes.status());
  }

  const body = await gradeRes.json();
  expect(body.success).toBeTruthy();
  expect(body.answer.points_earned).toBe(7);
  expect(body.answer.manually_reviewed).toBe(true);
});
