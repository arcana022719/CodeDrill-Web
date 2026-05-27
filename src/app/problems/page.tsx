import { getProblems, getCategories, getProblemStats, getUserCompletedCount } from '@/lib/problems';
import { getCurrentUserWithRole } from '@/lib/auth-roles';
import { redirect } from 'next/navigation';
import ProblemsClient from './ProblemsClient';

export default async function ProblemsPage() {
  // Route protection: only students can access problems
  const user = await getCurrentUserWithRole();
  if (!user || user.role !== 'student') {
    redirect('/');
  }

  const [problems, categories, stats, completed] = await Promise.all([
    getProblems({ limit: 20 }),
    getCategories(),
    getProblemStats(),
    getUserCompletedCount(),
  ]);

  return (
    <ProblemsClient
      initialProblems={problems}
      categories={categories}
      stats={stats}
      completed={completed}
    />
  );
}
