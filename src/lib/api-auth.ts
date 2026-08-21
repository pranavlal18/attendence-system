import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server-client";

// Verifies the request carries a valid Supabase access token belonging to an
// active ADMIN. Returns { userId } on success or a NextResponse error to return.
export async function requireAdmin(
  req: Request
): Promise<{ userId: string } | NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);

  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: pErr } = await supabaseServer
    .from("profiles")
    .select("role, is_active")
    .eq("user_id", data.user.id)
    .single();

  if (pErr || !profile || (profile as any).role !== "ADMIN" || (profile as any).is_active === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: data.user.id };
}
