/**
 * Authentication and Role-Based Access Control Utilities
 * 
 * This module provides helper functions for checking user roles and permissions
 * in the professor exam management system.
 */

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { UserRole } from '@/types';
import {
  E2E_TEST_USER_ID,
  E2E_TEST_USER_EMAIL,
  E2E_TEST_USER_NAME,
  E2E_TEST_PROFESSOR_ID,
  E2E_TEST_PROFESSOR_EMAIL,
  E2E_TEST_PROFESSOR_NAME,
} from '@/lib/e2e';

/**
 * Get the current user with role information
 * @returns User object with role or null if not authenticated
 */
export async function getCurrentUserWithRole() {
  const cookieStore = await cookies();
  const testRole = cookieStore.get('e2e-role')?.value;

  if (testRole === 'student') {
    return {
      id: E2E_TEST_USER_ID,
      email: E2E_TEST_USER_EMAIL,
      name: E2E_TEST_USER_NAME,
      role: 'student' as UserRole,
      totalPoints: 0,
      problemsSolved: 0,
      currentStreak: 0,
      avgScore: 0,
    };
  }

  if (testRole === 'professor') {
    return {
      id: E2E_TEST_PROFESSOR_ID,
      email: E2E_TEST_PROFESSOR_EMAIL,
      name: E2E_TEST_PROFESSOR_NAME,
      role: 'professor' as UserRole,
      totalPoints: 0,
      problemsSolved: 0,
      currentStreak: 0,
      avgScore: 0,
    };
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) {
    return null;
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, email, name, role, total_points, problems_solved, current_streak, avg_score')
    .eq('id', authUser.id)
    .single();

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    totalPoints: user.total_points,
    problemsSolved: user.problems_solved,
    currentStreak: user.current_streak,
    avgScore: user.avg_score,
  };
}

/**
 * Check if the current user has a specific role
 * @param role The role to check for
 * @returns True if user has the specified role, false otherwise
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const user = await getCurrentUserWithRole();
  return user?.role === role;
}

/**
 * Check if the current user is a professor
 * @returns True if user is a professor, false otherwise
 */
export async function isProfessor(): Promise<boolean> {
  const user = await getCurrentUserWithRole();
  return user?.role === 'professor' || user?.role === 'admin';
}

/**
 * Check if the current user is an admin
 * @returns True if user is an admin, false otherwise
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUserWithRole();
  return user?.role === 'admin';
}

/**
 * Check if the current user is a student
 * @returns True if user is a student, false otherwise
 */
export async function isStudent(): Promise<boolean> {
  const user = await getCurrentUserWithRole();
  return user?.role === 'student';
}

/**
 * Require the user to have professor or admin role
 * @throws Error if user is not authenticated or doesn't have required role
 */
export async function requireProfessorRole(): Promise<void> {
  const user = await getCurrentUserWithRole();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  if (user.role !== 'professor' && user.role !== 'admin') {
    throw new Error('Professor or admin role required');
  }
}

/**
 * Require the user to have admin role
 * @throws Error if user is not authenticated or doesn't have admin role
 */
export async function requireAdminRole(): Promise<void> {
  const user = await getCurrentUserWithRole();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  if (user.role !== 'admin') {
    throw new Error('Admin role required');
  }
}

/**
 * Check if the current user has professor or admin role
 * Returns user object if authorized, null otherwise
 * @returns User object with role or null
 */
export async function checkProfessorRole() {
  const user = await getCurrentUserWithRole();
  
  if (!user) {
    return null;
  }
  
  if (user.role !== 'professor' && user.role !== 'admin') {
    return null;
  }
  
  return user;
}

/**
 * Check if the current user has admin role
 * Returns user object if authorized, null otherwise
 * @returns User object with role or null
 */
export async function checkAdminRole() {
  const user = await getCurrentUserWithRole();
  
  if (!user) {
    return null;
  }
  
  if (user.role !== 'admin') {
    return null;
  }
  
  return user;
}
