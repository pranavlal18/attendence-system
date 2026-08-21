"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { WorkerCreateModal } from '@/features/workers/create-modal';
import { WorkerEditModal } from '@/features/workers/edit-modal';
import { AdminNav } from '@/components/admin-nav';
import { AdminGuard } from '@/components/admin-guard';

type Worker = {
  id: string;
  name: string;
  email: string;
  full_duty_rate: number;
  half_duty_rate: number;
  is_active: boolean;
  profile_id?: string;
  deleted_at?: string | null;
  profiles?: { name: string; email: string } | null;
};

export default function AdminWorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [currentWorker, setCurrentWorker] = useState<Worker | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [showDeactivated, setShowDeactivated] = useState(false);

  const fetchWorkers = async () => {
    let res = await supabase
      .from('workers')
      .select(`
        *,
        profiles (
          name,
          email
        )
      `)
      .is('deleted_at', null);

    // Fallback if migration hasn't been run yet (deleted_at column missing)
    if (res.error && /deleted_at/i.test(res.error.message)) {
      console.warn('deleted_at column missing — run migration 20260824000000_worker_deleted_at.sql');
      res = await supabase
        .from('workers')
        .select(`
          *,
          profiles (
            name,
            email
          )
        `);
    }

    if (res.error) {
      console.error('Error fetching workers:', res.error);
      return;
    }

    setWorkers((res.data as unknown as Worker[]) || []);
  };

  useEffect(() => {
    fetchWorkers();
  }, [createModalOpen, editModalOpen]);

  const createWorker = async (data: {
    name: string;
    email: string;
    password: string;
    full_duty_rate: number;
    half_duty_rate: number;
    is_active: boolean;
  }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/workers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error ?? "Failed to create worker");
      console.error("Create worker failed:", json);
      return;
    }
    fetchWorkers();
  };

  const deleteWorker = async (id: string) => {
    if (!confirm("Deactivate this worker? They won't be able to log in and won't appear in active list. Historical duties stay.")) return;
    // find profile_id for this worker to also deactivate profiles.is_active
    const w = workers.find((x) => x.id === id) as any;
    const profileName = w?.profiles?.name ?? w?.name;
    const { error: wErr } = await supabase.from("workers").update({ is_active: false }).eq("id", id);
    if (wErr) {
      console.error("Error deactivating worker:", wErr);
      alert(wErr.message);
      return;
    }
    // also deactivate profile so auth flow can block login (best-effort, requires RLS admin)
    try {
      // workers table has profile_id FK; fetch it if not in list
      let profileId: string | null = (w as any)?.profile_id ?? null;
      if (!profileId) {
        const { data } = await supabase.from("workers").select("profile_id").eq("id", id).single();
        profileId = (data as any)?.profile_id ?? null;
      }
      if (profileId) {
        const { error: pErr } = await supabase.from("profiles").update({ is_active: false }).eq("id", profileId);
        if (pErr) console.warn("profiles deactivate failed (may need admin RLS):", pErr.message);
      }
      // audit best-effort
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_logs").insert({
          actor_user_id: user.id,
          action: "DEACTIVATE_WORKER",
          entity_type: "worker",
          entity_id: id,
          old_value: JSON.stringify({ name: profileName }),
          new_value: JSON.stringify({ is_active: false }),
        });
      }
    } catch (e) {
      console.warn("deactivate audit/profile failed", e);
    }
    fetchWorkers();
  };

  const reactivateWorker = async (id: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/workers/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ action: "reactivate" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error ?? "Failed to reactivate worker");
      return;
    }
    fetchWorkers();
  };

  const deleteWorkerPermanent = async (id: string) => {
    const w = workers.find((x) => x.id === id) as any;
    const name = w?.profiles?.name ?? w?.name ?? "this worker";
    if (
      !confirm(
        `Permanently remove ${name} from the list?\n\nTheir duty records, payouts and salary history stay safely in the database — they just disappear from this UI and can never log in or be reactivated.`
      )
    )
      return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/workers/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ action: "delete" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error ?? "Failed to delete worker");
      return;
    }
    fetchWorkers();
  };

  const visibleWorkers = showDeactivated ? workers : workers.filter((w) => w.is_active);

  return (
    <AdminGuard>
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <AdminNav />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            Worker Management
          </h1>
          <button
            type="button"
            onClick={() => setCreateModalOpen(!createModalOpen)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + Create Worker
          </button>
        </div>

        {createModalOpen && (
          <WorkerCreateModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            onCreate={createWorker}
          />
        )}

        {currentWorker && editModalOpen && (
          <WorkerEditModal
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              setCurrentWorker(null);
            }}
            worker={currentWorker}
          />
        )}

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={showDeactivated}
              onChange={(e) => setShowDeactivated(e.target.checked)}
              className="h-4 w-4"
            />
            Show deactivated
          </label>
          <span className="text-xs text-zinc-500">{visibleWorkers.length} shown</span>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3 text-right">Full Rate</th>
                  <th className="px-4 py-3 text-right">Half Rate</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {visibleWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      {showDeactivated
                        ? "No workers at all. Click “+ Create Worker” to add one."
                        : "No active workers. Tick “Show deactivated” to see removed workers."}
                    </td>
                  </tr>
                ) : (
                  visibleWorkers.map((worker) => {
                    const p = (worker as any).profiles;
                    const name = (Array.isArray(p) ? p[0]?.name : p?.name) || worker.name;
                    const email = Array.isArray(p) ? p[0]?.email : p?.email;
                    return (
                      <tr key={worker.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{name}</span>
                            {email && <span className="text-xs text-zinc-500 dark:text-zinc-400">{email}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-100">
                          ₹{worker.full_duty_rate.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-100">
                          ₹{worker.half_duty_rate.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              worker.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                            }`}
                          >
                            {worker.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex flex-wrap justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentWorker(worker);
                                setEditModalOpen(true);
                              }}
                              className="inline-flex min-h-[32px] items-center rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
                            >
                              Edit
                            </button>
                            {worker.is_active ? (
                              <button
                                type="button"
                                onClick={() => deleteWorker(worker.id)}
                                className="inline-flex min-h-[32px] items-center rounded bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => reactivateWorker(worker.id)}
                                  className="inline-flex min-h-[32px] items-center rounded bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
                                >
                                  Reactivate
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteWorkerPermanent(worker.id)}
                                  title="Hide from UI permanently — DB history is kept"
                                  className="inline-flex min-h-[32px] items-center rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
    </AdminGuard>
  );
}
