import { z } from 'zod';

export const workerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters').describe('Initial password for worker'),
  full_duty_rate: z.number().int().positive('Full duty rate must be positive'),
  half_duty_rate: z.number().int().positive('Half duty rate must be positive'),
  is_active: z.boolean().default(true),
});

export type WorkerFormValues = z.infer<typeof workerSchema>;

// Edit schema: name/rates/status only — email is immutable and password
// changes are handled separately, so neither participates in form validation.
export const workerEditSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  full_duty_rate: z.number().int().positive('Full duty rate must be positive'),
  half_duty_rate: z.number().int().positive('Half duty rate must be positive'),
  is_active: z.boolean().default(true),
});

export type WorkerEditFormValues = z.infer<typeof workerEditSchema>;