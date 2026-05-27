import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'E2E mode disabled' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const pointsAwarded = typeof body.pointsAwarded === 'number' ? body.pointsAwarded : 8;
    const feedback = typeof body.feedback === 'string' ? body.feedback : 'Good structure and clear explanation.';

    const supabase = await createClient();

    // Find one pending essay submission
    const { data: pending, error: pendingErr } = await supabase
      .from('user_exam_answers')
      .select('id, points_earned, manually_reviewed, requires_grading')
      .eq('requires_grading', true)
      .eq('manually_reviewed', false)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingErr) {
      return NextResponse.json({ error: pendingErr.message }, { status: 500 });
    }

    if (!pending) {
      return NextResponse.json({ error: 'No pending essay submission found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
      .from('user_exam_answers')
      .update({
        points_earned: pointsAwarded,
        manually_reviewed: true,
        requires_grading: false,
        reviewer_feedback: feedback,
        graded_at: now,
      })
      .eq('id', pending.id)
      .select('id, points_earned, manually_reviewed, requires_grading, reviewer_feedback')
      .maybeSingle();

    if (updateErr || !updated) {
      console.error('E2E: failed to update essay grading', updateErr, updated);
      return NextResponse.json({ error: 'Failed to persist grading update' }, { status: 500 });
    }

    return NextResponse.json({ success: true, answer: updated });
  } catch (err) {
    console.error('E2E grade-essay error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
