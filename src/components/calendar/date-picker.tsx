"use client";

interface DatePickerProps {
  value: string;
  onChange: (v: string) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-zinc-300 bg-white p-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
    />
  );
}

export default DatePicker;
