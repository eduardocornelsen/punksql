import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      // Analytics is optional — silently skip if not authed
      return NextResponse.json({ ok: true });
    }

    const body = await request.json();
    const { challenge_id, submitted_sql, is_correct, execution_time_ms, xp_earned } = body;

    await supabase.from("challenge_attempts").insert({
      user_id: user.id,
      challenge_id,
      submitted_sql: submitted_sql?.slice(0, 2000) ?? "", // cap at 2000 chars
      is_correct: !!is_correct,
      execution_time_ms: execution_time_ms ?? null,
      xp_earned: xp_earned ?? 0,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Fire-and-forget — never break the client
    return NextResponse.json({ ok: true });
  }
}
