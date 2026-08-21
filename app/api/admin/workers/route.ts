import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server-client";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { name, email, password, full_duty_rate, half_duty_rate, is_active } = body as {
      name: string;
      email: string;
      password: string;
      full_duty_rate: number;
      half_duty_rate: number;
      is_active: boolean;
    };

    if (!name || !email || !password || !full_duty_rate || !half_duty_rate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // 1. Create auth user (service_role)
    const { data: authData, error: authError } = await supabaseServer.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError || !authData.user) {
      // If user already exists, surface clearly
      return NextResponse.json({ error: authError?.message ?? "Failed to create auth user" }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Create profile linked to auth user
    const { data: profile, error: profileError } = await supabaseServer
      .from("profiles")
      .insert({
        user_id: userId,
        name,
        email,
        role: "WORKER",
        phone: "",
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback auth user if profile fails
      await supabaseServer.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    // 3. Create worker linked to profile
    const { data: worker, error: workerError } = await supabaseServer
      .from("workers")
      .insert({
        profile_id: profile.id,
        full_duty_rate,
        half_duty_rate,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (workerError) {
      // Rollback profile + auth user
      await supabaseServer.from("profiles").delete().eq("id", profile.id);
      await supabaseServer.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: workerError.message }, { status: 400 });
    }

    // Optional audit log (best effort)
    try {
      await supabaseServer.from("audit_logs").insert({
        actor_user_id: auth.userId,
        action: "CREATE_WORKER",
        entity_type: "worker",
        entity_id: worker.id,
        old_value: null,
        new_value: JSON.stringify({ name, email, full_duty_rate, half_duty_rate }),
      });
    } catch (_) {}

    return NextResponse.json({ profile, worker }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/workers error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
