"use client";

interface DutyRecordCardProps {
  record: {
    id: string;
    date: string;
    duty_type: "FULL" | "HALF" | string;
    slot_number: number;
    rate_applied: number;
  };
  onRemove?: (id: string) => void;
}

export function DutyRecordCard({ record, onRemove }: DutyRecordCardProps) {
  const isFull = record.duty_type === "FULL";

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
              isFull
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
            }`}
          >
            {record.duty_type}
          </span>
          <span className="text-xs text-zinc-500">Slot {record.slot_number}</span>
        </div>
        <span className="text-sm text-zinc-600 dark:text-zinc-300">{record.date}</span>
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">₹{record.rate_applied}</span>
      </div>

      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(record.id)}
          className="min-h-[44px] rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          aria-label={`Remove duty ${record.id}`}
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}

export default DutyRecordCard;
