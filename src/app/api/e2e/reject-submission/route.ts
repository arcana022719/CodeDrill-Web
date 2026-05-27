import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { E2E_TEST_USER_ID } from '@/lib/e2e';

export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'E2E mode disabled' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const problemSlug = typeof body.problemSlug === 'string' ? body.problemSlug : undefined;

    const supabase = await createClient();

    // Find a problem to attach the submission to
    let problemQuery = supabase.from('problems').select('id, slug, title').limit(1);
    if (problemSlug) {
      problemQuery = supabase.from('problems').select('id, slug, title').eq('slug', problemSlug).limit(1);
    }
    const { data: problems, error: problemErr } = await problemQuery;
    if (problemErr || !problems || problems.length === 0) {
      return NextResponse.json({ error: 'No problem found to attach submission' }, { status: 404 });
    }

    const problem = problems[0];

    // Ensure a user row exists for the E2E test user
    const { data: existingUser } = await supabase.from('users').select('id').eq('id', E2E_TEST_USER_ID).maybeSingle();
    if (!existingUser) {
      await supabase.from('users').insert([
        { id: E2E_TEST_USER_ID, email: 'e2e@example.com', name: 'E2E Student' },
      ]).catch(() => null);
    }

    // Insert a wrong-answer submission (0 points)
    const now = new Date().toISOString();
    await supabase.from('submissions').insert({
      user_id: E2E_TEST_USER_ID,
      problem_id: problem.id,
      language: 'python',
      code: '# e2e incorrect submission',
      status: 'Wrong Answer',
      test_cases_passed: 0,
      total_test_cases: 1,
      points_earned: 0,
      submitted_at: now,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('E2E reject-submission error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
