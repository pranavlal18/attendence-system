export const DUTY_TYPES = {
  FULL: "FULL",
  HALF: "HALF",
} as const;

export type DutyType = (typeof DUTY_TYPES)[keyof typeof DUTY_TYPES];

export const FULL_MAX = 2;

export const HALF_MAX = 4;
