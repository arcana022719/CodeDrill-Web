import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { E2E_TEST_USER_ID } from '@/lib/e2e';

export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'E2E mode disabled' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const answer = typeof body.answer === 'string' ? body.answer : 'This is my essay answer.';

    const supabase = await createClient();

    // Find an exam question to attach the essay to
    const { data: questions, error: qErr } = await supabase.from('exam_questions').select('id, course_id, title, points').limit(1);
    if (qErr || !questions || questions.length === 0) {
      return NextResponse.json({ error: 'No exam question found to attach essay' }, { status: 404 });
    }

    const q = questions[0];

    // Insert into user_exam_answers flagged for manual review
    const now = new Date().toISOString();
    const { data: created, error: insertErr } = await supabase.from('user_exam_answers').insert({
      user_id: E2E_TEST_USER_ID,
      question_id: q.id,
      essay_answer: answer,
      word_count: (answer.split(/\s+/).filter(Boolean)).length,
      submitted_at: now,
      points_earned: 0,
      requires_grading: true,
      manually_reviewed: false,
    }).select().maybeSingle();

    if (insertErr || !created) {
      console.error('E2E: failed to insert essay submission', insertErr, created);
      return NextResponse.json({ error: 'Failed to create essay submission' }, { status: 500 });
    }

    return NextResponse.json({ success: true, manuallyReviewed: created.manually_reviewed ?? false });
  } catch (err) {
    console.error('E2E essay-submission error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
