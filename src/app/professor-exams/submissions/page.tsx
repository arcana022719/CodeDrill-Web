import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isProfessor } from '@/lib/auth-roles';
import { getSubmissionsForGrading } from '@/app/professor-exams/actions';
import Container from '@/components/shared/Container';
import SubmissionGradingInterface from '@/components/admin/SubmissionGradingInterface';

type SearchParams = {
  courseId?: string;
};

type SubmissionRow = {
  answer_id: string;
  course_id?: string | null;
  course_code?: string | null;
  course_name?: string | null;
  student_name: string;
  student_email: string;
  question_title: string;
  question_text: string | null;
  question_type: string;
  essay_answer: string | null;
  word_count: number | null;
  submitted_at: string;
  max_points: number;
  essay_requirements: unknown;
  points_earned: number | null;
  reviewer_feedback: string | null;
  graded_at: string | null;
  graded_by_name: string | null;
};

export default async function AllSubmissionsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isProfessor())) {
    redirect('/');
  }

  const requestedCourseId = searchParams?.courseId;

  // Get all courses so the filter popup can show submissions from any course.
  const { data: courses } = await supabase
    .from('professor_courses')
    .select('id, course_code, name')
    .order('course_code');

  const selectedCourse = requestedCourseId
    ? (courses || []).find((course) => course.id === requestedCourseId)
    : null;

  const coursesToLoad = selectedCourse ? [selectedCourse] : (courses || []);

  const submissionsByCourse = await Promise.all(
    coursesToLoad.map(async (course) => {
      const [pending, graded] = await Promise.all([
        getSubmissionsForGrading(course.id, undefined, 'ungraded'),
        getSubmissionsForGrading(course.id, undefined, 'graded'),
      ]);

      return {
        course,
        pending: pending.map((submission: SubmissionRow) => ({
          ...submission,
          course_id: course.id,
          course_code: course.course_code,
          course_name: course.name,
        })),
        graded: graded.map((submission: SubmissionRow) => ({
          ...submission,
          course_id: course.id,
          course_code: course.course_code,
          course_name: course.name,
        })),
      };
    })
  );

  const pendingSubmissions = submissionsByCourse.flatMap((item) => item.pending);
  const gradedSubmissions = submissionsByCourse.flatMap((item) => item.graded);

  return (
    <Container className="py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Grade Submissions</h1>
        <p className="text-gray-400">Review and grade student submissions across your courses</p>
      </div>

      <SubmissionGradingInterface
        initialPendingSubmissions={pendingSubmissions}
        initialGradedSubmissions={gradedSubmissions}
        availableCourses={courses || []}
          currentCourseId={selectedCourse?.id ?? null}
      />
    </Container>
  );
}
