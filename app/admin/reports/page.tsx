"use client";

import { useState, useEffect } from "react";
import {
  fetchMonthlyReport,
  fetchAvailableMonths,
  fetchPayouts,
  type MonthlyReport,
} from "@/services/report-service";
import { WorkerSummaryTable } from "@/components/reports/worker-summary-table";
import { MonthSelector } from "@/components/reports/month-selector";
import { PayoutForm } from "@/components/reports/payout-form";
import { PrintAttendanceSheet } from "@/components/reports/print-attendance-sheet";
import { AdminNav } from "@/components/admin-nav";

export default function ReportsPage() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [monthYear, setMonthYear] = useState(thisMonth);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutsMap, setPayoutsMap] = useState<Map<string, number>>(new Map());
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [payoutModal, setPayoutModal] = useState<{
    open: boolean;
    workerId: string;
    workerName: string;
    amount: number;
  } | null>(null);

  // Fetch available months on mount (optional population for selector)
  useEffect(() => {
    fetchAvailableMonths()
      .then(setAvailableMonths)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetchMonthlyReport(monthYear);
        if (cancelled) return;
        setReport(r);
        const payouts = await fetchPayouts(monthYear);
        if (cancelled) return;
        const m = new Map<string, number>();
        payouts.forEach((p) => {
          m.set(p.worker_id, (m.get(p.worker_id) || 0) + p.amount_paid);
        });
        setPayoutsMap(m);
      } catch (err) {
        console.error("ReportsPage load error:", err);
        if (!cancelled) {
          setReport(null);
          setPayoutsMap(new Map());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [monthYear]);

  const totals = report?.totals ?? { fullCount: 0, halfCount: 0, totalCount: 0, totalEarnings: 0, workerCount: 0 };
  const summaries = report?.summaries ?? [];

  // Adapter for getStatus expected by WorkerSummaryTable
  const getStatus = (workerId: string, earnings: number): string => {
    if (earnings <= 0) return "PAID";
    const paid = payoutsMap.get(workerId) || 0;
    if (paid === 0) return "UNPAID";
    if (paid >= earnings) return "PAID";
    return "PARTIALLY_PAID";
  };

  const handlePayoutClick = (workerId: string, workerName: string, earnings: number) => {
    setPayoutModal({ open: true, workerId, workerName, amount: earnings });
  };

  const refreshPayoutsAndReport = async () => {
    try {
      const [r, payouts] = await Promise.all([fetchMonthlyReport(monthYear), fetchPayouts(monthYear)]);
      setReport(r);
      const m = new Map<string, number>();
      payouts.forEach((p) => {
        m.set(p.worker_id, (m.get(p.worker_id) || 0) + p.amount_paid);
      });
      setPayoutsMap(m);
    } catch (err) {
      console.error("ReportsPage refresh error:", err);
    }
  };

  const handlePayoutSuccess = async () => {
    setPayoutModal(null);
    await refreshPayoutsAndReport();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="print:hidden">
        <AdminNav />
      </div>
      <div className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Monthly Reports</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Worker monthly Full/Half/Total + earnings (historical rate_applied)
        </p>
      </div>

      <div className="print:hidden">
        <MonthSelector value={monthYear} onChange={setMonthYear} />
      </div>

      {loading ? (
        <div className="space-y-4 print:hidden">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="mt-3 h-6 w-12 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
          <div className="animate-pulse rounded-lg border border-zinc-200 bg-white p-12 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mx-auto h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 print:hidden md:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Full Duties</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totals.fullCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Half Duties</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totals.halfCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Total Duties</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totals.totalCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Total Earnings</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">₹{totals.totalEarnings.toLocaleString()}</p>
            </div>
          </div>

          <div className="print:hidden">
            <WorkerSummaryTable summaries={summaries} totals={totals} getStatus={getStatus} onPayout={handlePayoutClick} />
          </div>
        </>
      )}

      <PrintAttendanceSheet monthYear={monthYear} />

      {payoutModal?.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
          onClick={() => setPayoutModal(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Record payout for ${payoutModal.workerName}`}
          >
            <PayoutForm
              workerId={payoutModal.workerId}
              workerName={payoutModal.workerName}
              monthYear={monthYear}
              defaultAmount={payoutModal.amount}
              onSuccess={handlePayoutSuccess}
              onCancel={() => setPayoutModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
