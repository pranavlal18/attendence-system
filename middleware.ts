import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { supabase } from '@/features/auth/auth-provider';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Legacy route-group URL that some cached pages still request — normalize to /login
  if (pathname === '/(auth)/login' || pathname.startsWith('/(auth)/login/')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // TEMP: disable auth-based redirects until @supabase/ssr is configured.
  // The previous implementation used an anon client without cookies, so
  // auth.getUser() always returned null and bounced /worker <-> /login in a loop
  // causing the "stuck at Signing in..." and spurious GET /login 307.
  // Keeping middleware as pass-through unblocks login; client-side guards still apply.
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/worker/:path*', '/login', '/'],
};