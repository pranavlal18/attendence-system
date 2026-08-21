import { z } from "zod";

export const dutySchema = z
  .object({
    worker_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    duty_type: z.enum(["FULL", "HALF"]),
    slot_number: z.number().int().min(1).max(4),
  })
  .superRefine((data, ctx) => {
    if (data.duty_type === "FULL" && data.slot_number > 2) {
      ctx.addIssue({
        code: "custom",
        path: ["slot_number"],
        message: "FULL duty slot_number must be between 1 and 2",
      });
    }
    if (data.duty_type === "HALF" && data.slot_number > 4) {
      ctx.addIssue({
        code: "custom",
        path: ["slot_number"],
        message: "HALF duty slot_number must be between 1 and 4",
      });
    }
  });

export type DutyFormValues = z.infer<typeof dutySchema>;
