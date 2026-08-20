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
  } = useForm<LoginForm>();
  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      alert(authError.message);
      setIsLoading(false);
      return;
    }

    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', authData.user.id)
        .single();

      if (profile?.role) {
        localStorage.setItem('userRole', profile.role);
      }
    }

    router.push(`/${authData.user.role === 'ADMIN' ? 'admin' : 'worker'}/dashboard`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 max-w-md w-full shadow-xl">
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
          Don't have an account?{' '}
          <a
            href="/(auth)/login"
            className="font-medium text-zinc-600 dark:text-zinc-400 underline underline-opacity-50"
          >
            Sign up as admin or worker
          </a>
        </p>
      </div>
    </div>
  );
}