import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { E2E_TEST_USER_ID, E2E_TEST_USER_EMAIL, E2E_TEST_USER_NAME } from '@/lib/e2e';

export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'E2E mode disabled' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const points = typeof body.points === 'number' ? body.points : 10;
    const problemSlug = typeof body.problemSlug === 'string' ? body.problemSlug : undefined;

    const supabase = await createClient();

    // Find a problem to attach the submission to
    let problemQuery = supabase.from('problems').select('id, slug, title').limit(1);
    if (problemSlug) {
      problemQuery = supabase.from('problems').select('id, slug, title').eq('slug', problemSlug).limit(1);
    }
    const { data: problems, error: problemErr } = await problemQuery;
    let problem;
    if (problemErr || !problems || problems.length === 0) {
      // Create a minimal problem for E2E tests
      const slug = problemSlug || 'e2e-sample-problem';
      const now = new Date().toISOString();
      const { data: created, error: createErr } = await supabase.from('problems').insert([
        {
          title: 'E2E Sample Problem',
          slug,
          description: 'Auto-generated E2E problem',
          difficulty: 'Easy',
          category: 'General',
          tags: [],
          acceptance_rate: 100,
          total_submissions: 0,
          total_accepted: 0,
          example_test_cases: [{ input: '1', output: '1' }],
          hidden_test_cases: [],
          starter_code: { python: 'print(input())' },
          created_at: now,
          updated_at: now,
        },
      ]).select().maybeSingle();

      if (createErr || !created) {
        console.error('E2E: failed to create problem', createErr, created);
        return NextResponse.json({ error: 'Failed to create e2e problem' }, { status: 500 });
      }

      problem = created;
    } else {
      problem = problems[0];
    }

    // Ensure a user row exists for the E2E test user
    const { data: existingUser } = await supabase.from('users').select('id, total_points, problems_solved, current_streak').eq('id', E2E_TEST_USER_ID).maybeSingle();

    if (!existingUser) {
      await supabase.from('users').insert([
        {
          id: E2E_TEST_USER_ID,
          email: E2E_TEST_USER_EMAIL,
          name: E2E_TEST_USER_NAME,
          total_points: 0,
          problems_solved: 0,
          current_streak: 0,
          avg_score: 100,
        },
      ]);
    }

    // Insert an accepted submission
    const now = new Date().toISOString();
    await supabase.from('submissions').insert({
      user_id: E2E_TEST_USER_ID,
      problem_id: problem.id,
      language: 'python',
      code: '# e2e test submission',
      status: 'Accepted',
      test_cases_passed: 1,
      total_test_cases: 1,
      points_earned: points,
      submitted_at: now,
    });

    // Update user totals directly so UI reflects changes
    const { data: userRow } = await supabase.from('users').select('total_points, problems_solved, current_streak').eq('id', E2E_TEST_USER_ID).maybeSingle();
    const currentPoints = (userRow?.total_points as number) || 0;
    const currentSolved = (userRow?.problems_solved as number) || 0;
    const currentStreak = (userRow?.current_streak as number) || 0;

    const { data: updatedUser } = await supabase.from('users').update({
      total_points: currentPoints + points,
      problems_solved: currentSolved + 1,
      current_streak: currentStreak + 1,
    }).eq('id', E2E_TEST_USER_ID).select().maybeSingle();

    return NextResponse.json({ success: true, newTotals: {
      totalPoints: updatedUser?.total_points ?? (currentPoints + points),
      problemsSolved: updatedUser?.problems_solved ?? (currentSolved + 1),
      currentStreak: updatedUser?.current_streak ?? (currentStreak + 1),
    } });
  } catch (err) {
    console.error('E2E accept-submission error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
