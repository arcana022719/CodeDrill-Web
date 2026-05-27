import { test, expect } from '@playwright/test';

test('CSV export is professor-only: student gets 403, professor gets CSV', async ({ page }) => {
  // Student role should be forbidden
  await page.goto('/auth/callback?code=test-google-login');
  const studentRes = await page.request.get('/api/leaderboard/export');
  expect(studentRes.status()).toBe(403);

  // Professor role should get CSV download
  await page.goto('/auth/callback?code=test-professor-login');
  const professorRes = await page.request.get('/api/leaderboard/export');

  if (!professorRes.ok()) {
    const text = await professorRes.text().catch(() => '<no-body>');
    console.error('CSV export failed for professor:', professorRes.status(), text);
    throw new Error('Professor CSV export failed: ' + professorRes.status());
  }

  const contentType = professorRes.headers()['content-type'] || '';
  const contentDisposition = professorRes.headers()['content-disposition'] || '';
  const csvText = await professorRes.text();

  expect(contentType).toContain('text/csv');
  expect(contentDisposition.toLowerCase()).toContain('attachment');
  expect(csvText).toContain('Rank,Name,Email');
});
