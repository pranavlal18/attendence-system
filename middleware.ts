import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { supabase } from '@/features/auth/auth-provider';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the user from supabase auth
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // If accessing admin/worker routes without auth, redirect to login
    if (pathname.startsWith('/admin') || pathname.startsWith('/worker')) {
      const loginUrl = new URL('/(auth)/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Fetch user's role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const userRole = profile?.role as 'ADMIN' | 'WORKER' | null;

  // Route protection based on role
  if (pathname.startsWith('/admin') && userRole !== 'ADMIN') {
    const dashUrl = new URL('/worker/dashboard', request.url);
    return NextResponse.redirect(dashUrl);
  }

  if (pathname.startsWith('/worker') && userRole !== 'WORKER') {
    const dashUrl = new URL('/admin/dashboard', request.url);
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/worker/:path*', '/(auth)/login', '/'],
};