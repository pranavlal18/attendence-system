"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * Client-side access guard for /admin pages.
 * - Not logged in        -> redirect to /login
 * - Logged in, not ADMIN -> redirect to /worker (their correct home)
 * - ADMIN                -> render children
 *
 * While the check runs, renders a neutral placeholder so no admin content flashes.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "allowed">("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, is_active")
          .eq("user_id", user.id)
          .single();

        if (!profile || profile.role !== "ADMIN" || profile.is_active === false) {
          window.location.href = "/worker";
          return;
        }

        if (!cancelled) setState("allowed");
      } catch {
        window.location.href = "/login";
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">Checking access…</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default AdminGuard;
