"use client";

import { useState } from 'react';
import { supabase } from '@/features/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        alert(authError.message);
        return;
      }

      let userRole: string | null = null;
      if (authData.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', authData.user.id)
          .single();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          alert('Login succeeded but profile not found. Contact admin. ' + profileError.message);
          return;
        }

        if (profile?.role) {
          localStorage.setItem('userRole', profile.role);
          userRole = profile.role;
        } else {
          alert('No role assigned to this user.');
          return;
        }
      }

      const dest = `/${userRole === 'ADMIN' ? 'admin' : 'worker'}`;
      // Use hard navigation to avoid stale router + middleware loop
      window.location.href = dest;
    } catch (e) {
      console.error('Login exception:', e);
      alert(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 sm:p-8 max-w-md w-full shadow-xl">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6 text-center">Sign In</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Email</label>
            <input
              {...register('email')}
              type="email"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 focus:border-transparent"
              placeholder="Enter your email"
              required
            />
            {errors.email && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Password</label>
            <input
              {...register('password')}
              type="password"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 focus:border-transparent"
              placeholder="Enter your password"
              minLength={6}
              required
            />
            {errors.password && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.password.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-zinc-600 text-white font-medium rounded-md disabled:opacity-50 transition-colors hover:bg-zinc-700"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm mt-4 text-zinc-500 dark:text-zinc-400">
          Don&apos;t have an account? Contact your administrator.
        </p>
      </div>
    </div>
  );
}