import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server-client";
import { requireAdmin } from "@/lib/api-auth";

// PATCH /api/admin/workers/[id]  body: { action: "delete" | "reactivate" }
// delete      -> soft-delete: sets deleted_at + is_active=false (DB history preserved)
// reactivate  -> clears deleted_at + is_active=true. Admin only.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { id: workerId } = await params;
    const body = await req.json();
    const action = (body as { action?: string }).action;

    if (action !== "delete" && action !== "reactivate") {
      return NextResponse.json({ error: 'action must be "delete" or "reactivate"' }, { status: 400 });
    }

    // 1. Fetch worker + profile name for audit
    const { data: worker, error: wErr } = await supabaseServer
      .from("workers")
      .select("id, profile_id, is_active, deleted_at, profiles(name)")
      .eq("id", workerId)
      .single();

    if (wErr || !worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const profileId = (worker as any).profile_id as string;
    const rawProfiles = (worker as any).profiles;
    const profileName = Array.isArray(rawProfiles) ? (rawProfiles[0]?.name ?? null) : (rawProfiles?.name ?? null);

    const now = new Date().toISOString();
    const newActive = action === "reactivate";
    const newDeletedAt = action === "delete" ? now : null;

    // 2. Update workers row
    const { error: updErr } = await supabaseServer
      .from("workers")
      .update({ is_active: newActive, deleted_at: newDeletedAt })
      .eq("id", workerId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    // 3. Sync profiles.is_active so login flow can block/reactivate access
    try {
      await supabaseServer.from("profiles").update({ is_active: newActive }).eq("id", profileId);
    } catch (_) {}

    // 4. Audit
    try {
      await supabaseServer.from("audit_logs").insert({
        actor_user_id: auth.userId,
        action: action === "delete" ? "DELETE_WORKER" : "REACTIVATE_WORKER",
        entity_type: "worker",
        entity_id: workerId,
        old_value: JSON.stringify({ is_active: (worker as any).is_active, deleted_at: (worker as any).deleted_at }),
        new_value: JSON.stringify({ is_active: newActive, deleted_at: newDeletedAt, name: profileName }),
      });
    } catch (_) {}

    return NextResponse.json({ success: true, action }, { status: 200 });
  } catch (e) {
    console.error("PATCH /api/admin/workers/[id] error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
