'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/features/auth/auth-provider';
import { isAuthenticated, isRole, UserRole } from '@/lib/auth';

export function Navigation() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const storedRole = isAuthenticated();
    if (storedRole) {
      const role = localStorage.getItem('userRole') as UserRole | null;
      setUserRole(role!);
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(user.email?.split('@')[0] || 'User');
      }
    });
  }, []);

  if (!userRole) {
    return (
      <div className="hidden">
        <Link href="/(auth)/login">Sign in</Link>
      </div>
    );
  }

  return (
    <nav className="bg-zinc-200 dark:bg-zinc-700 p-4 rounded-md shadow-sm">
      <div className="flex items-center gap-4">
        <span className="text-zinc-800 dark:text-zinc-200 font-medium">
          Welcome, {userName}
        </span>

        {userRole === 'ADMIN' ? (
          <>
            <Link
              href="/admin/dashboard"
              className="mr-3 px-3 py-1 text-zinc-800 dark:text-zinc-200 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            >
              Admin Panel
            </Link>
            <Link
              href="/admin/workers"
              className="px-3 py-1 text-zinc-800 dark:text-zinc-200 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            >
              Manage Workers
            </Link>
          </>
        ) : userRole === 'WORKER' && (
          <>
            <Link
              href="/worker/dashboard"
              className="mr-3 px-3 py-1 text-zinc-800 dark:text-zinc-200 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/worker/records"
              className="px-3 py-1 text-zinc-800 dark:text-zinc-200 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            >
              My Records
            </Link>
          </>
        )}

        <button
          onClick={() => {
            supabase.auth.signOut();
            localStorage.removeItem('userRole');
            setUserRole(null);
            setUserName('');
          }}
          className="ml-auto px-3 py-1 text-zinc-800 dark:text-zinc-200 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}