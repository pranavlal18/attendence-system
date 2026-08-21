import { logAction as baseLogAction, type LogActionParams } from "@/lib/audit-logger";

/**
 * Audit service wrapper for admin correction/remove flows.
 * Spec Sections 17, 20, 21: Admin correction/remove must keep audit trail.
 *
 * Re-exports logAction and provides typed helpers for duty_records.
 */

export type AuditAction = "DELETE_DUTY" | "CORRECT_DUTY" | "CREATE_DUTY" | "UPDATE_DUTY";

export interface DutyAuditParams {
  actorUserId: string | null;
  action: AuditAction;
  entityId: string;
  oldValue: unknown | null;
  newValue: unknown | null;
}

export async function logAction(params: LogActionParams) {
  return baseLogAction(params);
}

export async function logDutyAction(params: DutyAuditParams) {
  return baseLogAction({
    actorUserId: params.actorUserId,
    action: params.action,
    entityType: "duty_record",
    entityId: params.entityId,
    oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
    newValue: params.newValue ? JSON.stringify(params.newValue) : null,
  });
}

/**
 * Convenience: log DELETE_DUTY
 */
export async function logDutyDelete(
  actorUserId: string | null,
  record: unknown,
  entityId: string
) {
  return logDutyAction({
    actorUserId,
    action: "DELETE_DUTY",
    entityId,
    oldValue: record,
    newValue: null,
  });
}

/**
 * Convenience: log CORRECT_DUTY (admin remove-and-correct flow)
 */
export async function logDutyCorrect(
  actorUserId: string | null,
  record: unknown,
  entityId: string
) {
  return logDutyAction({
    actorUserId,
    action: "CORRECT_DUTY",
    entityId,
    oldValue: record,
    newValue: null,
  });
}
