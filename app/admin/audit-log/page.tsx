"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import {
  fetchAuditLogs,
  fetchAuditActions,
  type AuditLog,
  type AuditFilters,
} from "@/services/audit-service";
import { AdminNav } from "@/components/admin-nav";

const PAGE_SIZE = 20;

function getActionBadgeClasses(action: string): string {
  const a = action.toUpperCase();
  if (a.startsWith("CREATE")) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
  if (a.startsWith("DELETE")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
  if (a.startsWith("CORRECT")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800";
  if (a === "CHANGE_RATE") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
  if (a === "DEACTIVATE_WORKER") return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800";
  if (a.includes("UPDATE") || a.includes("CHANGE")) return "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-600";
}

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), "PP p");
  } catch {
    return iso;
  }
}

function truncateValue(v: string | null): string {
  if (!v) return "—";
  const s = v.trim();
  if (s.length <= 80) return s;
  return s.slice(0, 80) + "…";
}

function tryPrettyJson(v: string | null): string {
  if (!v) return "—";
  try {
    const parsed = JSON.parse(v);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return v;
  }
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [page, setPage] = useState(1);
  const pageSize = PAGE_SIZE;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<string[]>([]);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  // Fetch distinct actions on mount
  useEffect(() => {
    let cancelled = false;
    async function loadActions() {
      try {
        const list = await fetchAuditActions();
        if (!cancelled) setActions(list);
      } catch (err) {
        console.error("fetchAuditActions failed:", err);
      }
    }
    loadActions();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchLogs = useCallback(async (f: AuditFilters, p: number) => {
    setLoading(true);
    try {
      const res = await fetchAuditLogs(f, p, PAGE_SIZE);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error("fetchAuditLogs failed:", err);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced fetch on filters/page change
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchLogs(filters, page);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, page, fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleClear = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  const updateFilter = useCallback(
    (patch: Partial<AuditFilters>) => {
      setFilters((prev) => ({ ...prev, ...patch }));
      setPage(1);
    },
    []
  );

  // helpers for controlled inputs that allow clearing
  const setActionFilter = (v: string) => updateFilter({ action: v || undefined });
  const setEntityTypeFilter = (v: string) => updateFilter({ entityType: v || undefined });
  const setDateFrom = (v: string) => updateFilter({ dateFrom: v || undefined });
  const setDateTo = (v: string) => updateFilter({ dateTo: v || undefined });
  const setSearch = (v: string) => updateFilter({ search: v || undefined });

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <AdminNav />
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">Audit Log</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Who did what when - money-affecting actions</p>
          </div>
        </header>

        {/* Filters bar */}
        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="grid gap-3 sm:grid-cols-6">
            <label className="text-sm sm:col-span-1">
              <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Action</span>
              <select
                value={filters.action ?? ""}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">All Actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm sm:col-span-1">
              <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Entity</span>
              <select
                value={filters.entityType ?? ""}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="w-full min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">All Entities</option>
                <option value="worker">worker</option>
                <option value="duty_record">duty_record</option>
                <option value="payout">payout</option>
              </select>
            </label>

            <label className="text-sm sm:col-span-1">
              <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">From</span>
              <input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From"
                className="w-full min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>

            <label className="text-sm sm:col-span-1">
              <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">To</span>
              <input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To"
                className="w-full min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>

            <label className="text-sm sm:col-span-1">
              <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Search</span>
              <input
                type="text"
                value={filters.search ?? ""}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>

            <div className="flex items-end sm:col-span-1">
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex w-full min-h-[44px] items-center justify-center rounded-md border bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {loading ? "Loading…" : `${total} ${total === 1 ? "entry" : "entries"}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex min-h-[44px] items-center rounded-md border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Prev
            </button>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex min-h-[44px] items-center rounded-md border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Next
            </button>
          </div>
        </div>

        {/* Table / Cards */}
        <div className="rounded-lg border bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-zinc-500">Loading audit logs…</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">No audit logs found for current filters.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left dark:bg-zinc-700/50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">Time</th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">Actor</th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">Action</th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">Entity</th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">Old→New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-t dark:border-zinc-700 hover:bg-zinc-50/60 dark:hover:bg-zinc-700/30">
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatTime(log.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {log.actor_name || log.actor_email || `${log.actor_user_id.slice(0, 8)}…`}
                          </div>
                          {log.actor_name && log.actor_email ? (
                            <div className="text-xs text-zinc-500">{log.actor_email}</div>
                          ) : null}
                          {!log.actor_name && !log.actor_email ? (
                            <div className="text-xs text-zinc-500" title={log.actor_user_id}>
                              {log.actor_user_id.slice(0, 8)}…
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getActionBadgeClasses(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {log.entity_type}:{log.entity_id.slice(0, 8)}
                        </td>
                        <td className="max-w-[280px] px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setDetailLog(log)}
                            className="text-left font-mono text-xs text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                            title="Click to view full values"
                          >
                            <span className="line-clamp-2 break-all">{truncateValue(log.old_value)} → {truncateValue(log.new_value)}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile responsive cards */}
              <div className="divide-y dark:divide-zinc-700 sm:hidden">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getActionBadgeClasses(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-zinc-500">{formatTime(log.created_at)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {log.actor_name || log.actor_email || `${log.actor_user_id.slice(0, 8)}…`}
                      </span>
                      <span className="mx-1 text-zinc-400">•</span>
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {log.entity_type}:{log.entity_id.slice(0, 8)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailLog(log)}
                      className="w-full rounded-md border bg-zinc-50 px-3 py-2 text-left font-mono text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    >
                      <span className="line-clamp-2 break-all">{truncateValue(log.old_value)} → {truncateValue(log.new_value)}</span>
                      <span className="mt-1 block text-[11px] text-zinc-400">Tap to view details</span>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bottom pagination repeat for long lists */}
        {logs.length > 0 && (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex min-h-[44px] items-center rounded-md border bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
            >
              Prev
            </button>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex min-h-[44px] items-center rounded-md border bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailLog(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-lg border bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Audit Detail</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {detailLog.action} • {detailLog.entity_type}:{detailLog.entity_id} • {formatTime(detailLog.created_at)}
                </p>
                <p className="text-xs text-zinc-500">
                  Actor: {detailLog.actor_name || detailLog.actor_email || detailLog.actor_user_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailLog(null)}
                className="inline-flex min-h-[44px] items-center rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">old_value</h3>
                <pre className="max-h-[50vh] overflow-auto rounded-md border bg-zinc-50 p-3 text-xs font-mono whitespace-pre-wrap break-all dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  {tryPrettyJson(detailLog.old_value)}
                </pre>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">new_value</h3>
                <pre className="max-h-[50vh] overflow-auto rounded-md border bg-zinc-50 p-3 text-xs font-mono whitespace-pre-wrap break-all dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  {tryPrettyJson(detailLog.new_value)}
                </pre>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailLog(null)}
                className="inline-flex min-h-[44px] items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
