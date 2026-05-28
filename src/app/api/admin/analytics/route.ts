import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type AdminStudentAnalyticsRow = {
  user_id: string;
  student_name: string;
  student_email: string;
  total_submissions: number | null;
  total_points: number | null;
  avg_accuracy: number | null;
  last_submission_at: string | null;
};

async function requireProfessorOrAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, userRecord: null } as const;
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  return { supabase, user, userRecord } as const;
}

export async function GET(request: Request) {
  const { supabase, user, userRecord } = await requireProfessorOrAdmin();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!userRecord || (userRecord.role !== 'professor' && userRecord.role !== 'admin')) {
    return NextResponse.json({ error: 'Professor or admin role required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('course_id');

  const { data: studentRows, error } = await supabase.rpc('get_admin_student_analytics', {
    p_course_id: courseId || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: AdminStudentAnalyticsRow[] = (studentRows ?? []) as AdminStudentAnalyticsRow[];

  const students = rows.map((student) => ({
    user_id: student.user_id,
    users: {
      id: student.user_id,
      name: student.student_name,
      email: student.student_email,
    },
    accuracy: Number(student.avg_accuracy || 0),
    total_points: Number(student.total_points || 0),
    submission_count: Number(student.total_submissions || 0),
    last_submission_at: student.last_submission_at,
  })).sort((left, right) => {
    if (right.submission_count !== left.submission_count) {
      return right.submission_count - left.submission_count;
    }

    if (right.accuracy !== left.accuracy) {
      return right.accuracy - left.accuracy;
    }

    return left.users.name.localeCompare(right.users.name);
  });

  const totalStudents = students.length;
  const activeStudents = students.filter((student) => student.submission_count > 0);
  const totalSubmissions = students.reduce((sum, student) => sum + student.submission_count, 0);
  const avgAccuracy = activeStudents.length > 0
    ? activeStudents.reduce((sum, student) => sum + student.accuracy, 0) / activeStudents.length
    : 0;
  const completionRate = totalStudents > 0
    ? (activeStudents.length / totalStudents) * 100
    : 0;

  return NextResponse.json({
    analytics: {
      totalStudents,
      avgAccuracy: Math.round(avgAccuracy * 100) / 100,
      totalSubmissions,
      completionRate: Math.round(completionRate * 100) / 100,
      students,
    }
  });
}
