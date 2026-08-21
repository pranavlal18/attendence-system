import { z } from "zod";
import { WORKER_MAX_FULL, WORKER_MAX_HALF } from "../../constants/duty-types";

const MAX_SLOTS_PER_DAY = WORKER_MAX_FULL + WORKER_MAX_HALF; // 3 (2F + 1H)

export const dutySchema = z.object({
  worker_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  duty_type: z.enum(["FULL", "HALF"]),
  slot_number: z.number().int().min(1).max(MAX_SLOTS_PER_DAY),
});

export type DutyFormValues = z.infer<typeof dutySchema>;
