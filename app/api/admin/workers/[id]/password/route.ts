import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server-client";
import { requireAdmin } from "@/lib/api-auth";

// POST /api/admin/workers/[id]/password  body: { password }
// Resets a worker's login password via Supabase Auth (service_role). Admin only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { id: workerId } = await params;
    const body = await req.json();
    const password = (body as { password?: string }).password;

    if (!password || String(password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // 1. Find worker -> profile -> auth user id (profiles.user_id, NOT profiles.id)
    const { data: worker, error: wErr } = await supabaseServer
      .from("workers")
      .select("id, profile_id, profiles(user_id)")
      .eq("id", workerId)
      .single();

    if (wErr || !worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const rawProfile = (worker as { profiles?: { user_id?: string } | Array<{ user_id?: string }> | null })
      .profiles;
    const authUserId = Array.isArray(rawProfile)
      ? rawProfile[0]?.user_id
      : rawProfile?.user_id;

    if (!authUserId) {
      return NextResponse.json(
        { error: "Worker has no linked login account" },
        { status: 404 }
      );
    }

    // 2. Update the auth user's password
    const { error: updErr } = await supabaseServer.auth.admin.updateUserById(
      authUserId,
      { password: String(password) }
    );

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    // 3. Audit (best effort)
    try {
      await supabaseServer.from("audit_logs").insert({
        actor_user_id: auth.userId,
        action: "CHANGE_PASSWORD",
        entity_type: "worker",
        entity_id: workerId,
        old_value: null,
        new_value: JSON.stringify({ password_reset: true }),
      });
    } catch (_) {}

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("POST /api/admin/workers/[id]/password error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
