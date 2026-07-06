// Runs the remaining TV Time import steps in one go, with a single login:
//   1. Mark archived-on-TV-Time shows as "dropped" (episodes stay untouched)
//   2. Add followed-only shows (0 episodes watched) as "Want to Watch"
//   3. Add watched movies as "completed" with their real watched date
//   4. Add "want to watch" movies as "watchlist"
//
// Usage:
//   node 11-finish-remaining.mjs "<path to tv time export folder>"          (dry run)
//   node 11-finish-remaining.mjs "<path to tv time export folder>" --commit (writes for real)
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readCsvObjects } from "./lib/csv.mjs";
import { loadEnvLocal } from "./lib/env.mjs";
import { ask, askHidden } from "./lib/prompt.mjs";

const dataDir = path.join(import.meta.dirname, "data");
const commit = process.argv.includes("--commit");
const exportDir = process.argv.slice(2).find((a) => !a.startsWith("--"));

loadEnvLocal(path.join(import.meta.dirname, "..", "..", ".env.local"));
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

function baseId(tvtimeId) {
  return tvtimeId.split("-s")[0];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tmdbFetch(pathname) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  url.searchParams.set("language", "en-US");
  const headers = { accept: "application/json" };
  if (TMDB_API_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${TMDB_API_KEY}`;
  else url.searchParams.set("api_key", TMDB_API_KEY);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${pathname}`);
  return res.json();
}

async function main() {
  if (!exportDir || !fs.existsSync(path.join(exportDir, "followed_tv_show.csv"))) {
    console.error('Usage: node 11-finish-remaining.mjs "<path to tv time export folder>" [--commit]');
    process.exit(1);
  }

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

  // ---------- 1. Mark archived shows as dropped ----------
  console.log("== 1/4: marking archived shows as dropped ==");
  const followed = readCsvObjects(path.join(exportDir, "followed_tv_show.csv"), fs);
  const archivedIds = new Set(followed.filter((r) => r.archived === "1").map((r) => r.tv_show_id));
  const { shows: resolvedShows } = JSON.parse(fs.readFileSync(path.join(dataDir, "resolved-shows.json"), "utf8"));
  const toDrop = resolvedShows.filter((s) => archivedIds.has(baseId(s.tvtimeId)));

  let droppedWritten = 0;
  for (const [i, s] of toDrop.entries()) {
    console.log(`  [${i + 1}/${toDrop.length}] ${s.tvtimeName} -> "${s.title}" (tmdb ${s.tmdbId})`);
    if (!commit) continue;
    const { error } = await supabase
      .from("library_items")
      .update({ status: "dropped" })
      .eq("user_id", userId)
      .eq("tmdb_id", s.tmdbId)
      .eq("media_type", "tv");
    if (error) console.error(`  ! failed (code ${error.code}): ${error.message}`);
    else droppedWritten++;
  }
  console.log(`-> ${droppedWritten}/${toDrop.length} updated\n`);

  // ---------- 2. Add followed-only shows as Want to Watch ----------
  console.log("== 2/4: adding followed-only shows as Want to Watch ==");
  const { shows: followedOnly } = JSON.parse(fs.readFileSync(path.join(dataDir, "resolved-followed.json"), "utf8"));

  let followedWritten = 0;
  for (const [i, s] of followedOnly.entries()) {
    const label = `[${i + 1}/${followedOnly.length}] ${s.tvtimeName} -> "${s.title}" (tmdb ${s.tmdbId})`;
    let details;
    try {
      details = await tmdbFetch(`/tv/${s.tmdbId}`);
    } catch (err) {
      console.error(`  ! ${label}: TMDB lookup failed (${err.message})`);
      continue;
    }
    await sleep(80);
    console.log(`  ${label}`);
    if (!commit) continue;
    const { error } = await supabase.from("library_items").upsert(
      {
        user_id: userId,
        tmdb_id: s.tmdbId,
        media_type: "tv",
        status: "watchlist",
        title: details.name,
        poster_path: details.poster_path,
        release_date: details.first_air_date || null,
      },
      { onConflict: "user_id,tmdb_id,media_type" }
    );
    if (error) console.error(`  ! failed (code ${error.code}): ${error.message}`);
    else followedWritten++;
  }
  console.log(`-> ${followedWritten}/${followedOnly.length} added\n`);

  // ---------- 3. Add watched movies as completed ----------
  console.log("== 3/4: adding watched movies ==");
  const { movies } = JSON.parse(fs.readFileSync(path.join(dataDir, "movies-match-report.json"), "utf8"));
  const resolvedMovies = movies.filter((m) => m.chosenTmdbId);

  let moviesWritten = 0;
  for (const [i, m] of resolvedMovies.entries()) {
    const label = `[${i + 1}/${resolvedMovies.length}] ${m.title} -> "${m.chosenTitle}" (tmdb ${m.chosenTmdbId}), watched ${m.watchedAt.slice(0, 10)}`;
    let details;
    try {
      details = await tmdbFetch(`/movie/${m.chosenTmdbId}`);
    } catch (err) {
      console.error(`  ! ${label}: TMDB lookup failed (${err.message})`);
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
        status: "completed",
        title: details.title,
        poster_path: details.poster_path,
        release_date: details.release_date || null,
        created_at: m.watchedAt,
        updated_at: m.watchedAt,
      },
      { onConflict: "user_id,tmdb_id,media_type" }
    );
    if (error) console.error(`  ! failed (code ${error.code}): ${error.message}`);
    else moviesWritten++;
  }
  console.log(`-> ${moviesWritten}/${resolvedMovies.length} added\n`);

  // ---------- 4. Add "want to watch" movies as watchlist ----------
  console.log("== 4/4: adding want-to-watch movies ==");
  const { movies: towatchMovies } = JSON.parse(
    fs.readFileSync(path.join(dataDir, "towatch-movies-match-report.json"), "utf8")
  );
  const resolvedTowatch = towatchMovies.filter((m) => m.chosenTmdbId);

  let towatchWritten = 0;
  for (const [i, m] of resolvedTowatch.entries()) {
    const label = `[${i + 1}/${resolvedTowatch.length}] ${m.title} -> "${m.chosenTitle}" (tmdb ${m.chosenTmdbId})`;
    let details;
    try {
      details = await tmdbFetch(`/movie/${m.chosenTmdbId}`);
    } catch (err) {
      console.error(`  ! ${label}: TMDB lookup failed (${err.message})`);
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
      },
      { onConflict: "user_id,tmdb_id,media_type" }
    );
    if (error) console.error(`  ! failed (code ${error.code}): ${error.message}`);
    else towatchWritten++;
  }
  console.log(`-> ${towatchWritten}/${resolvedTowatch.length} added\n`);

  console.log(commit ? "All done." : "Dry run complete — rerun with --commit to write these changes.");
}

main();
