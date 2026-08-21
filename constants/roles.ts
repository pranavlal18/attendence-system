export const ROLES = {
  ADMIN: "ADMIN",
  WORKER: "WORKER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
