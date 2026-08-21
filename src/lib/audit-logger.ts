import { supabase } from "@/lib/supabase/client";

export interface LogActionParams {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: string | null;
  newValue?: string | null;
}

export async function logAction(params: LogActionParams): Promise<{ success: boolean; error?: string }> {
  const { actorUserId, action, entityType, entityId, oldValue, newValue } = params;

  try {
    if (!actorUserId) {
      console.warn("logAction: missing actorUserId, skipping insert", { action, entityType, entityId });
      return { success: false, error: "Missing actorUserId" };
    }

    const { error } = await supabase.from("audit_logs").insert({
      actor_user_id: actorUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    });

    if (error) {
      console.error("logAction insert error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("logAction unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
