// One-time fix: re-derive Watching/Completed status for every TV show in
// your library using the current rule (caught up on episodes actually
// released, per last_episode_to_air — not the raw season total, which can
// include not-yet-aired episodes). Shows imported before this rule existed
// (e.g. the TV Time import) may still be sitting on the old classification.
//
// Usage:
//   node scripts/fix-tv-statuses.mjs          (dry run)
//   node scripts/fix-tv-statuses.mjs --commit (writes for real)
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./tvtime-import/lib/env.mjs";
import { ask, askHidden } from "./tvtime-import/lib/prompt.mjs";

const commit = process.argv.includes("--commit");

loadEnvLocal(new URL("../.env.local", import.meta.url).pathname);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const ENDED_TV_STATUSES = ["Ended", "Canceled"];

async function tmdbTvDetails(id) {
  const url = new URL(`https://api.themoviedb.org/3/tv/${id}`);
  url.searchParams.set("language", "en-US");
  const headers = { accept: "application/json" };
  if (TMDB_API_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${TMDB_API_KEY}`;
  else url.searchParams.set("api_key", TMDB_API_KEY);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status} for tv/${id}`);
  return res.json();
}

function releasedEpisodeCount(show) {
  const last = show.last_episode_to_air;
  if (!last || last.season_number <= 0) return 0;
  const priorSeasons = show.seasons
    .filter((s) => s.season_number > 0 && s.season_number < last.season_number)
    .reduce((sum, s) => sum + s.episode_count, 0);
  return priorSeasons + last.episode_number;
}

function deriveStatus(seen, show) {
  const released = releasedEpisodeCount(show);
  return released > 0 && seen >= released ? "completed" : "watching";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(commit ? "Mode: COMMIT (will write to Supabase)\n" : "Mode: DRY RUN (nothing will be written; pass --commit to apply)\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const email = await ask("Supabase login email: ");
  const password = await askHidden("Password: ");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    console.error("Login failed:", authError?.message);
    process.exit(1);
  }
  const userId = authData.user.id;
  console.log(`Logged in as ${authData.user.email} (${userId})\n`);

  const { data: library, error: libError } = await supabase
    .from("library_items")
    .select("tmdb_id, status, title")
    .eq("user_id", userId)
    .eq("media_type", "tv")
    .in("status", ["watching", "completed"]);
  if (libError) throw libError;

  const counts = new Map();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("watched_episodes")
      .select("tmdb_show_id, season_number")
      .eq("user_id", userId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data) {
      if (row.season_number === 0) continue;
      counts.set(row.tmdb_show_id, (counts.get(row.tmdb_show_id) ?? 0) + 1);
    }
    if (data.length < pageSize) break;
  }

  console.log(`${library.length} TV shows to check.\n`);

  let fixed = 0;
  let skippedEnded = 0;
  for (const [i, item] of library.entries()) {
    let show;
    try {
      show = await tmdbTvDetails(item.tmdb_id);
    } catch (err) {
      console.error(`  ! [${i + 1}/${library.length}] ${item.title}: TMDB lookup failed (${err.message})`);
      continue;
    }
    await sleep(60);

    if (ENDED_TV_STATUSES.includes(show.status)) {
      skippedEnded++;
      continue;
    }

    const seen = counts.get(item.tmdb_id) ?? 0;
    const nextStatus = deriveStatus(seen, show);
    if (nextStatus === item.status) continue;

    console.log(`  [${i + 1}/${library.length}] ${item.title}: ${item.status} -> ${nextStatus}`);
    fixed++;
    if (!commit) continue;

    const { error } = await supabase
      .from("library_items")
      .update({ status: nextStatus })
      .eq("user_id", userId)
      .eq("tmdb_id", item.tmdb_id)
      .eq("media_type", "tv");
    if (error) console.error(`    ! update failed: ${error.message}`);
  }

  console.log(`\n${fixed} show(s) ${commit ? "fixed" : "would be fixed"}. ${skippedEnded} ended show(s) skipped (already final).`);
  console.log(commit ? "Done." : "Dry run complete — rerun with --commit to write these changes.");
}

main();
