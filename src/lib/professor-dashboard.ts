import { createClient } from '@/lib/supabase/server';
import { unstable_noStore as noStore } from 'next/cache';
import { getSubmissionsForGrading } from '@/app/professor-exams/actions';

export interface ProfessorDashboardStats {
  courseCount: number;
  templateCount: number;
  submissionCount: number;
}

/**
 * Fetch dashboard stats for professors/admins.
 * Currently scoped to overall counts the user can access.
 */
export async function getProfessorDashboardStats(): Promise<ProfessorDashboardStats> {
  noStore();

  const supabase = await createClient();

  // Ensure user is authenticated and has professor/admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userError || !userRecord || (userRecord.role !== 'professor' && userRecord.role !== 'admin')) {
    throw new Error('Professor or admin role required');
  }

  const [coursesCount, templatesCount, courses] = await Promise.all([
    supabase.from('professor_courses').select('*', { count: 'exact', head: true }),
    supabase.from('exam_templates').select('*', { count: 'exact', head: true }),
    supabase.from('professor_courses').select('id').order('course_code'),
  ]);

  const submissionLists = await Promise.all(
    (courses.data || []).map(async (course) => {
      const [pending, graded] = await Promise.all([
        getSubmissionsForGrading(course.id, undefined, 'ungraded'),
        getSubmissionsForGrading(course.id, undefined, 'graded'),
      ]);

      return [...pending, ...graded];
    })
  );

  const submissionsCount = submissionLists.reduce((total, submissions) => total + submissions.length, 0);

  return {
    courseCount: coursesCount.count ?? 0,
    templateCount: templatesCount.count ?? 0,
    submissionCount: submissionsCount,
  };
}