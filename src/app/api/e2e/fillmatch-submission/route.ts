import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { E2E_TEST_USER_ID } from '@/lib/e2e';

export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'E2E mode disabled' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const answer = typeof body.answer === 'string' ? body.answer : 'TestAnswer';
    const supabase = await createClient();

    // Find a problem to attach the submission to
    const { data: problems, error: problemErr } = await supabase.from('problems').select('id, slug, title').limit(1);
    if (problemErr || !problems || problems.length === 0) {
      return NextResponse.json({ error: 'No problem found to attach submission' }, { status: 404 });
    }

    const problem = problems[0];

    // Insert accepted submission to simulate case-insensitive exact match
    const now = new Date().toISOString();
    const { data: created, error: insertErr } = await supabase.from('submissions').insert({
      user_id: E2E_TEST_USER_ID,
      problem_id: problem.id,
      language: 'python',
      code: `# e2e fillmatch answer: ${answer}`,
      status: 'Accepted',
      test_cases_passed: 1,
      total_test_cases: 1,
      points_earned: 10,
      submitted_at: now,
    }).select().maybeSingle();

    if (insertErr || !created) {
      console.error('E2E: failed to insert fillmatch submission', insertErr, created);
      return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 });
    }

    return NextResponse.json({ success: true, submission: created });
  } catch (err) {
    console.error('E2E fillmatch-submission error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
