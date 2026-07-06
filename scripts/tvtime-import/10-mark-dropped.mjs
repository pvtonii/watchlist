// Flips library_items.status to "dropped" for shows that TV Time has
// archived=1 (you told it you stopped watching) and that we imported as
// "watching" (partial progress). Does NOT touch watched_episodes — the
// episode marks/dates stay exactly as imported.
// Dry-run by default — pass --commit to actually write.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readCsvObjects } from "./lib/csv.mjs";
import { loadEnvLocal } from "./lib/env.mjs";
import { ask, askHidden } from "./lib/prompt.mjs";

const dataDir = path.join(import.meta.dirname, "data");
const commit = process.argv.includes("--commit");
const exportDir = process.argv[3] ?? process.argv[2]; // allow either arg position

loadEnvLocal(path.join(import.meta.dirname, "..", "..", ".env.local"));
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function baseId(tvtimeId) {
  return tvtimeId.split("-s")[0];
}

async function main() {
  const followedPath = exportDir
    ? path.join(exportDir, "followed_tv_show.csv")
    : null;
  if (!followedPath || !fs.existsSync(followedPath)) {
    console.error("Usage: node 10-mark-dropped.mjs <path to tv time export folder> [--commit]");
    process.exit(1);
  }

  const followed = readCsvObjects(followedPath, fs);
  const archivedIds = new Set(followed.filter((r) => r.archived === "1").map((r) => r.tv_show_id));

  const { shows } = JSON.parse(fs.readFileSync(path.join(dataDir, "resolved-shows.json"), "utf8"));
  const toDrop = shows.filter((s) => archivedIds.has(baseId(s.tvtimeId)));

  console.log(`${toDrop.length} shows to mark as "dropped".`);
  console.log(commit ? "Mode: COMMIT (will write to Supabase)\n" : "Mode: DRY RUN (nothing will be written; pass --commit to apply)\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let userId = null;
  if (commit) {
    const email = await ask("Supabase login email: ");
    const password = await askHidden("Password: ");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      console.error("Login failed:", authError?.message);
      process.exit(1);
    }
    userId = authData.user.id;
    console.log(`Logged in as ${authData.user.email} (${userId})\n`);
  }

  let written = 0;
  let failed = 0;
  for (const [i, s] of toDrop.entries()) {
    console.log(`  [${i + 1}/${toDrop.length}] ${s.tvtimeName} -> "${s.title}" (tmdb ${s.tmdbId})`);
    if (!commit) continue;

    const { error } = await supabase
      .from("library_items")
      .update({ status: "dropped" })
      .eq("user_id", userId)
      .eq("tmdb_id", s.tmdbId)
      .eq("media_type", "tv");
    if (error) {
      console.error(`  ! update failed (code ${error.code}): ${error.message}`);
      failed++;
    } else {
      written++;
    }
  }

  console.log(commit ? `\nDone. Updated: ${written}, failed: ${failed}` : "\nDry run complete — rerun with --commit to write these changes.");
}

main();
