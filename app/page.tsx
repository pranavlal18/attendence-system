import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-6">
      <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-lg p-8 shadow text-center space-y-4">
        <h1 className="text-2xl font-semibold">Shift Attendance System</h1>
        <p className="text-sm text-zinc-500">Manage Full & Half duties — Admin and Worker portals.</p>
        <div className="flex justify-center">
          <Link href="/login" className="w-full px-4 py-2 rounded bg-zinc-900 text-white min-h-[44px] inline-flex items-center justify-center hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
