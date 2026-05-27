import { NextRequest, NextResponse } from 'next/server';
import { exportLeaderboardCSV } from '@/app/leaderboard/actions';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const courseId = searchParams.get('courseId') || undefined;

  // E2E seam: allow role-guard testing without real OAuth sessions.
  if (process.env.E2E_TEST_MODE === 'true') {
    const cookieStore = await cookies();
    const testRole = cookieStore.get('e2e-role')?.value;

    if (testRole) {
      if (testRole !== 'professor' && testRole !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const supabase = await createClient();
      const { data, error } = await supabase.rpc('get_leaderboard', {
        p_course_id: courseId || null,
        p_category: null,
        p_limit: 1000,
        p_offset: 0,
      });

      if (error) {
        return NextResponse.json({ error: 'Failed to export CSV' }, { status: 500 });
      }

      const headers = [
        'Rank',
        'Name',
        'Email',
        'Total Points',
        'Problems Solved',
        'Average Score',
        'Current Streak',
        'Rank Change',
        'Badges',
      ];

      const rows = (data || []).map((entry: any) => [
        entry.rank,
        entry.name,
        entry.email,
        entry.total_points,
        entry.problems_solved,
        entry.avg_score,
        entry.current_streak,
        entry.rank_change,
        Array.isArray(entry.badges)
          ? entry.badges.map((b: any) => `${b.emoji || ''} ${b.name || ''}`.trim()).join('; ')
          : '',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map((cell) => `"${String(cell ?? '')}"`).join(',')),
      ].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="leaderboard-${courseId || 'global'}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }
  }

  const result = await exportLeaderboardCSV(courseId);

  if (!result.success || !result.csv) {
    return NextResponse.json(
      { error: result.error || 'Failed to export CSV' },
      { status: result.error === 'Unauthorized' ? 403 : 500 }
    );
  }

  // Return CSV file
  return new NextResponse(result.csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="leaderboard-${courseId || 'global'}-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
