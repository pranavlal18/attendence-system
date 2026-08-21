import { supabase } from "@/lib/supabase/client";
import { logAction as baseLogAction, type LogActionParams } from "@/lib/audit-logger";

/**
 * Audit service - Phase 8A (Spec Sections 17, 20, 21)
 * Provides filterable fetch with pagination and actor profile enrichment,
 * plus legacy wrappers for duty_records correction/remove flows.
 */

export type AuditAction =
  | "CREATE_WORKER"
  | "DEACTIVATE_WORKER"
  | "CHANGE_RATE"
  | "RECORD_DUTY"
  | "CREATE_DUTY_ADMIN"
  | "CORRECT_DUTY"
  | "DELETE_DUTY"
  | "CREATE_PAYOUT"
  | "CREATE_DUTY"
  | "UPDATE_DUTY"
  | string;

// ---------------------------------------------------------------------------
// Interfaces required by Phase 8A spec
// ---------------------------------------------------------------------------

export interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_email?: string;
  actor_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface AuditFilters {
  action?: string;
  entityType?: string;
  actorUserId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  search?: string;
}

export interface AuditPage {
  logs: AuditLog[];
  total: number;
}

// ---------------------------------------------------------------------------
// Existing wrappers (preserve)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNextDayISODate(dateStr: string): string {
  // dateStr: YYYY-MM-DD -> next day YYYY-MM-DD
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeIlikePattern(value: string): string {
  // Escape PostgREST special chars for ilike within or filter
  // %, _, and comma (separator in or filter) need handling
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, "\\,");
}

// ---------------------------------------------------------------------------
// fetchAuditLogs - filterable, paginated, actor-enriched
// ---------------------------------------------------------------------------

export async function fetchAuditLogs(
  filters: AuditFilters = {},
  page = 1,
  pageSize = 20
): Promise<AuditPage> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));
  const offset = (safePage - 1) * safePageSize;

  try {
    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + safePageSize - 1);

    if (filters.action) {
      query = query.eq("action", filters.action);
    }

    if (filters.entityType) {
      query = query.eq("entity_type", filters.entityType);
    }

    if (filters.actorUserId) {
      query = query.eq("actor_user_id", filters.actorUserId);
    }

    if (filters.dateFrom) {
      // gte start of day UTC
      query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
    }

    if (filters.dateTo) {
      // lt next day at 00:00:00
      const nextDay = getNextDayISODate(filters.dateTo);
      query = query.lt("created_at", `${nextDay}T00:00:00.000Z`);
    }

    if (filters.search && filters.search.trim() !== "") {
      const raw = filters.search.trim();
      const escaped = escapeIlikePattern(raw);
      // ilike on action, entity_type, old_value, new_value
      const pattern = `%${escaped}%`;
      // Supabase or filter syntax: column.operator.value
      query = query.or(
        `action.ilike.${pattern},entity_type.ilike.${pattern},old_value.ilike.${pattern},new_value.ilike.${pattern}`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("fetchAuditLogs query error:", error);
      return { logs: [], total: 0 };
    }

    const rows = (data ?? []) as Array<{
      id: string;
      actor_user_id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      old_value: string | null;
      new_value: string | null;
      created_at: string;
    }>;

    const total = count ?? rows.length;

    if (rows.length === 0) {
      return { logs: [], total };
    }

    // Fetch actor profiles for display: audit actor_user_id is auth.users.id => profiles.user_id
    const uniqueActorIds = [...new Set(rows.map((r) => r.actor_user_id).filter(Boolean))];

    let profileMap = new Map<string, { name: string; email: string }>();

    if (uniqueActorIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", uniqueActorIds);

      if (profileError) {
        console.warn("fetchAuditLogs profile fetch error:", profileError);
        // Fallback: try matching by id if user_id column mismatch (some schemas use id)
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from("profiles")
          .select("id, user_id, name, email")
          .in("id", uniqueActorIds);

        if (!fallbackError && fallbackRows) {
          for (const p of fallbackRows as unknown as Array<{
            id: string;
            user_id: string | null;
            name: string;
            email: string;
          }>) {
            const key = (p.user_id ?? p.id) as string;
            if (key) profileMap.set(key, { name: p.name, email: p.email });
          }
        }
      } else {
        for (const p of (profileRows ?? []) as Array<{
          user_id: string;
          name: string;
          email: string;
        }>) {
          if (p.user_id) profileMap.set(p.user_id, { name: p.name, email: p.email });
        }
      }
    }

    const logs: AuditLog[] = rows.map((r) => {
      const info = profileMap.get(r.actor_user_id);
      return {
        id: r.id,
        actor_user_id: r.actor_user_id,
        actor_name: info?.name,
        actor_email: info?.email,
        action: r.action,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        old_value: r.old_value,
        new_value: r.new_value,
        created_at: r.created_at,
      };
    });

    return { logs, total };
  } catch (err) {
    console.error("fetchAuditLogs unexpected error:", err);
    return { logs: [], total: 0 };
  }
}

// ---------------------------------------------------------------------------
// fetchAuditActions - distinct action list
// ---------------------------------------------------------------------------

export async function fetchAuditActions(): Promise<string[]> {
  try {
    const { data, error } = await supabase.from("audit_logs").select("action");

    if (error) {
      console.error("fetchAuditActions query error:", error);
      return [];
    }

    const rows = (data ?? []) as Array<{ action: string }>;
    const distinct = [...new Set(rows.map((r) => r.action).filter(Boolean))];
    distinct.sort((a, b) => a.localeCompare(b));
    return distinct;
  } catch (err) {
    console.error("fetchAuditActions unexpected error:", err);
    return [];
  }
}
