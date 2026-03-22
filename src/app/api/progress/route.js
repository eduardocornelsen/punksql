import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_progress")
      .select("xp, solved_ids, streak_days, last_active, lang, updated_at")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ progress: data || null });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { xp, solved_ids, lang, streak_days } = body;

    const { error } = await supabase
      .from("user_progress")
      .upsert({
        user_id: user.id,
        xp: xp ?? 0,
        solved_ids: solved_ids ?? [],
        lang: lang ?? "en",
        streak_days: streak_days ?? 0,
        last_active: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
