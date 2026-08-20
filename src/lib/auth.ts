import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type UserRole = 'ADMIN' | 'WORKER';

export function getUserRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userRole') as UserRole | null;
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('userRole') !== null;
}

export function isRole(role: UserRole): boolean {
  return getUserRole() === role;
}