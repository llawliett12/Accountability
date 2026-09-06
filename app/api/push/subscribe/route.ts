import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Thin authenticated route handler (not a server action) because it's
// called from imperative browser code (PushManager callbacks), not a form.
// Auth is still enforced the same way as every server action in this repo:
// via the user's session cookie + Supabase, never a client-supplied user id.

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const authKey = body?.keys?.auth;
  const validString = (v: unknown, maxLen: number) =>
    typeof v === "string" && v.length > 0 && v.length <= maxLen;

  if (!validString(endpoint, 2048) || !validString(p256dh, 512) || !validString(authKey, 512)) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: endpoint as string,
      p256dh: p256dh as string,
      auth_key: authKey as string,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 512) || null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint !== "string" || body.endpoint.length === 0 || body.endpoint.length > 2048) {
    return NextResponse.json({ error: "Missing or invalid endpoint" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint as string)
    .eq("user_id", user.id); // scoped to own rows even though endpoint is unique

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
