"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/workers", label: "Workers" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/audit-log", label: "Audit Log" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <nav className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-white p-2 dark:border-zinc-700 dark:bg-zinc-800">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`inline-flex min-h-[36px] items-center rounded-md px-3 py-1.5 text-sm font-medium ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="ml-auto inline-flex min-h-[36px] items-center rounded-md border px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        {loggingOut ? "Logging out…" : "Log out"}
      </button>
    </nav>
  );
}

export default AdminNav;
