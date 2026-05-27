import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { E2E_TEST_USER_ID } from '@/lib/e2e';

export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'E2E mode disabled' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const visible = typeof body.visible === 'boolean' ? body.visible : false;

    const supabase = await createClient();

    const { error: updateErr } = await supabase
      .from('users')
      .update({ leaderboard_visible: visible })
      .eq('id', E2E_TEST_USER_ID);

    if (updateErr) {
      console.error('E2E: failed to toggle leaderboard visibility', updateErr);
      return NextResponse.json({ error: 'Failed to update leaderboard visibility' }, { status: 500 });
    }

    const { data: row, error: readErr } = await supabase
      .from('users')
      .select('id, name, leaderboard_visible')
      .eq('id', E2E_TEST_USER_ID)
      .maybeSingle();

    if (readErr || !row) {
      console.error('E2E: failed to read visibility row', readErr, row);
      return NextResponse.json({ error: 'Failed to verify leaderboard visibility' }, { status: 500 });
    }

    const { data: leaderboardRows, error: leaderboardErr } = await supabase.rpc('get_leaderboard', {
      p_course_id: null,
      p_category: null,
      p_limit: 100,
      p_offset: 0,
    });

    if (leaderboardErr) {
      console.error('E2E: get_leaderboard failed', leaderboardErr);
      return NextResponse.json({ error: 'Failed to read leaderboard' }, { status: 500 });
    }

    const present = (leaderboardRows || []).some((r: any) => r.user_id === E2E_TEST_USER_ID);

    return NextResponse.json({
      success: true,
      visibility: row.leaderboard_visible,
      presentOnLeaderboard: present,
    });
  } catch (err) {
    console.error('E2E leaderboard-visibility error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
