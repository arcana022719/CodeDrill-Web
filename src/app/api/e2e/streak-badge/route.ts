import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { E2E_TEST_USER_ID, E2E_TEST_USER_EMAIL, E2E_TEST_USER_NAME } from '@/lib/e2e';

export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'E2E mode disabled' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const streakDays = typeof body.streakDays === 'number' ? body.streakDays : 7;

    const supabase = await createClient();

    // Ensure E2E student exists and has a 7+ day streak
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', E2E_TEST_USER_ID)
      .maybeSingle();

    if (!existingUser) {
      const { error: insertErr } = await supabase.from('users').insert([
        {
          id: E2E_TEST_USER_ID,
          email: E2E_TEST_USER_EMAIL,
          name: E2E_TEST_USER_NAME,
          role: 'student',
          total_points: 0,
          problems_solved: 0,
          current_streak: streakDays,
          avg_score: 0,
          leaderboard_visible: true,
        },
      ]);
      if (insertErr) {
        console.error('E2E: failed to create student for streak badge', insertErr);
        return NextResponse.json({ error: 'Failed to create test student' }, { status: 500 });
      }
    } else {
      const { error: streakErr } = await supabase
        .from('users')
        .update({ current_streak: streakDays, leaderboard_visible: true })
        .eq('id', E2E_TEST_USER_ID);

      if (streakErr) {
        console.error('E2E: failed to update streak', streakErr);
        return NextResponse.json({ error: 'Failed to update streak' }, { status: 500 });
      }
    }

    // Find the Consistent badge id and award it if missing
    const { data: badgeRow, error: badgeErr } = await supabase
      .from('achievement_badges')
      .select('id, name')
      .eq('name', 'Consistent')
      .maybeSingle();

    if (badgeErr || !badgeRow) {
      console.error('E2E: consistent badge not found', badgeErr, badgeRow);
      return NextResponse.json({ error: 'Consistent badge not found' }, { status: 500 });
    }

    const { error: awardErr } = await supabase.from('user_badges').insert({
      user_id: E2E_TEST_USER_ID,
      badge_id: badgeRow.id,
    });

    if (awardErr && !String(awardErr.message || '').toLowerCase().includes('duplicate')) {
      console.error('E2E: failed to award consistent badge', awardErr);
      return NextResponse.json({ error: 'Failed to award consistent badge' }, { status: 500 });
    }

    // Verify user appears on leaderboard with Consistent badge
    const { data: leaderboardRows, error: leaderboardErr } = await supabase.rpc('get_leaderboard', {
      p_course_id: null,
      p_category: null,
      p_limit: 100,
      p_offset: 0,
    });

    if (leaderboardErr) {
      console.error('E2E: get_leaderboard failed for badge verification', leaderboardErr);
      return NextResponse.json({ error: 'Failed to verify leaderboard badge state' }, { status: 500 });
    }

    const row = (leaderboardRows || []).find((r: any) => r.user_id === E2E_TEST_USER_ID);
    const badges = (row?.badges || []) as Array<{ name?: string }>;
    const consistentOnLeaderboard = badges.some((b) => b?.name === 'Consistent');

    return NextResponse.json({
      success: true,
      streakDays,
      badgeAwarded: true,
      onLeaderboard: !!row,
      consistentOnLeaderboard,
    });
  } catch (err) {
    console.error('E2E streak-badge error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
