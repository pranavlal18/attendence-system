export interface DutyRecord {
  id: string;
  worker_id: string;
  date: string;
  duty_type: "FULL" | "HALF";
  slot_number: number;
  rate_applied: number;
  created_at: string;
  created_by: string | null;
}
