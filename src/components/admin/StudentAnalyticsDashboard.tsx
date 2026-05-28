'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';

type StudentAnalytics = {
  totalStudents: number;
  avgAccuracy: number;
  totalSubmissions: number;
  completionRate: number;
  students: Array<{
    user_id: string;
    accuracy: number;
    total_points: number;
    users: { name: string; email: string };
  }>;
};

export function StudentAnalyticsDashboard({ courseId }: { courseId?: string }) {
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [courseId]);

  async function loadAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (courseId) params.append('course_id', courseId);

      const res = await fetch(`/api/admin/analytics?${params}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load analytics');
      }

      setAnalytics(data.analytics || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load analytics';
      console.error('Failed to load analytics:', error);
      setError(message);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <Card><p className="text-gray-600">Loading analytics...</p></Card>;
  }

  if (error) {
    return (
      <Card>
        <p className="font-medium text-red-600">Unable to load analytics</p>
        <p className="mt-1 text-sm text-gray-600">{error}</p>
      </Card>
    );
  }

  if (!analytics) {
    return <Card><p className="text-gray-600">No analytics data available</p></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Total Students</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.totalStudents}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Avg Accuracy</p>
            <p className="text-3xl font-bold text-green-600">{analytics.avgAccuracy.toFixed(1)}%</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Total Submissions</p>
            <p className="text-3xl font-bold text-blue-600">{analytics.totalSubmissions}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
            <p className="text-3xl font-bold text-purple-600">{analytics.completionRate.toFixed(1)}%</p>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Student Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Student</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Email</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Accuracy</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Points</th>
              </tr>
            </thead>
            <tbody>
              {analytics.students.slice(0, 20).map((student) => (
                <tr key={student.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{student.users.name}</td>
                  <td className="py-3 px-4 text-gray-600 text-sm">{student.users.email}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-semibold ${
                      student.accuracy >= 80 ? 'text-green-600' :
                      student.accuracy >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {student.accuracy.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900 font-medium">{student.total_points}</td>
                </tr>
              ))}
              {analytics.students.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 px-4 text-center text-gray-500">
                    No student activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
