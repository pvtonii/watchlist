import { createClient } from "@supabase/supabase-js";

/**
 * Hit daily by .github/workflows/keepalive.yml — a real write keeps the
 * Supabase project from auto-pausing for inactivity on the free tier. Uses
 * the service_role key (server-only) since the fixed row has no RLS policy.
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("keepalive")
    .upsert({ id: 1, pinged_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, ts: new Date().toISOString() });
}
