import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Only call this inside event handlers,
 * queryFn/mutationFn or useEffect — never at module/render scope,
 * so builds don't require real env values.
 */
export function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
