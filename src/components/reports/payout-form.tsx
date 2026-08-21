"use client";

import { useState } from "react";
import { createPayout } from "@/services/report-service";

export interface PayoutFormProps {
  workerId: string;
  workerName: string;
  monthYear: string; // YYYY-MM
  defaultAmount?: number;
  onSuccess: () => void;
  onCancel?: () => void;
}

type PaymentMethod = "UPI" | "Cash" | "Bank Transfer";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PayoutForm({
  workerId,
  workerName,
  monthYear,
  defaultAmount,
  onSuccess,
  onCancel,
}: PayoutFormProps) {
  const [amountPaid, setAmountPaid] = useState<string>(
    defaultAmount !== undefined && defaultAmount > 0 ? String(defaultAmount) : ""
  );
  const [paymentDate, setPaymentDate] = useState<string>(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedAmount = Number(amountPaid);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (!paymentDate) {
      setError("Payment date is required");
      return;
    }

    setLoading(true);
    try {
      const result = await createPayout({
        workerId,
        monthYear,
        amountPaid: parsedAmount,
        paymentDate,
        paymentMethod,
        notes: notes.trim() || null,
      });
      if (!result.success) {
        setError(result.error || "Failed to record payout");
        return;
      }
      setSuccess(`Payout of ₹${parsedAmount.toLocaleString()} recorded for ${workerName}`);
      // briefly show success then notify parent
      setTimeout(() => {
        onSuccess();
      }, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Record Payout</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {workerName} &middot; {monthYear}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="payout-amount" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Amount Paid (₹)
          </label>
          <input
            id="payout-amount"
            type="number"
            min={1}
            step={1}
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="e.g. 5000"
            required
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="payout-date" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Payment Date
          </label>
          <input
            id="payout-date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="payout-method" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Payment Method
          </label>
          <select
            id="payout-method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>
        </div>

        <div>
          <label htmlFor="payout-notes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notes
          </label>
          <textarea
            id="payout-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes"
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300">
          {success}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex min-h-[36px] items-center justify-center rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-[36px] items-center justify-center rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {loading ? "Recording..." : "Record Payout"}
        </button>
      </div>
    </form>
  );
}

export default PayoutForm;
