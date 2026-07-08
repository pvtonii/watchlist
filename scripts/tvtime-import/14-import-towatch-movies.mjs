// Adds recovered "want to watch" movies to library_items as "watchlist"
// (never watched, so created_at/updated_at just get "now").
// Dry-run by default — pass --commit to actually write.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./lib/env.mjs";
import { ask, askHidden } from "./lib/prompt.mjs";

const dataDir = path.join(import.meta.dirname, "data");
const commit = process.argv.includes("--commit");

loadEnvLocal(path.join(import.meta.dirname, "..", "..", ".env.local"));
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function tmdbMovieDetails(id) {
  const url = new URL(`https://api.themoviedb.org/3/movie/${id}`);
  url.searchParams.set("language", "en-US");
  const headers = { accept: "application/json" };
  if (TMDB_API_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${TMDB_API_KEY}`;
  else url.searchParams.set("api_key", TMDB_API_KEY);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status} for movie/${id}`);
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { movies } = JSON.parse(fs.readFileSync(path.join(dataDir, "towatch-movies-match-report.json"), "utf8"));
  const resolved = movies.filter((m) => m.chosenTmdbId);

  console.log(`${resolved.length} movies to import.`);
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

  const now = new Date().toISOString();

  let done = 0;
  let written = 0;
  let failed = 0;
  for (const m of resolved) {
    done++;
    const label = `[${done}/${resolved.length}] ${m.title} -> "${m.chosenTitle}" (tmdb ${m.chosenTmdbId})`;

    let details;
    try {
      details = await tmdbMovieDetails(m.chosenTmdbId);
    } catch (err) {
      console.error(`  ! ${label}: TMDB lookup failed (${err.message}), skipping`);
      failed++;
      continue;
    }
    await sleep(80);

    console.log(`  ${label}`);
    if (!commit) continue;

    const { error } = await supabase.from("library_items").upsert(
      {
        user_id: userId,
        tmdb_id: m.chosenTmdbId,
        media_type: "movie",
        status: "watchlist",
        title: details.title,
        poster_path: details.poster_path,
        release_date: details.release_date || null,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,tmdb_id,media_type" }
    );
    if (error) {
      console.error(`  ! library_items upsert failed (code ${error.code}): ${error.message}`);
      failed++;
    } else {
      written++;
    }
  }

  console.log(commit ? `\nDone. Written: ${written}, failed: ${failed}` : "\nDry run complete — rerun with --commit to write these changes.");
}

main();
