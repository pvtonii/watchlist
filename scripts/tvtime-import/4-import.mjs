// Writes resolved-shows.json into Supabase (library_items + watched_episodes)
// for the logged-in user. Dry-run by default — pass --commit to actually write.
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { shows } = JSON.parse(
    fs.readFileSync(path.join(dataDir, "resolved-shows.json"), "utf8")
  );

  console.log(`${shows.length} shows, ${shows.reduce((n, s) => n + s.episodes.length, 0)} episodes to import.`);
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

  let done = 0;
  let totalEpisodesWritten = 0;
  let totalEpisodeErrors = 0;
  for (const show of shows) {
    done++;
    const label = `[${done}/${shows.length}] ${show.tvtimeName} -> "${show.title}" (tmdb ${show.tmdbId})`;

    let details;
    try {
      details = await tmdbTvDetails(show.tmdbId);
    } catch (err) {
      console.error(`  ! ${label}: TMDB lookup failed (${err.message}), skipping`);
      continue;
    }
    await sleep(80);

    const totalRegularEpisodes = (details.seasons ?? [])
      .filter((s) => s.season_number > 0)
      .reduce((n, s) => n + s.episode_count, 0);
    const watchedRegularEpisodes = show.episodes.filter((e) => e.season > 0).length;
    const status = totalRegularEpisodes > 0 && watchedRegularEpisodes >= totalRegularEpisodes
      ? "completed"
      : "watching";

    console.log(`  ${label} — ${watchedRegularEpisodes}/${totalRegularEpisodes} regular eps -> status "${status}"`);

    if (!commit) continue;

    const { error: libError } = await supabase.from("library_items").upsert(
      {
        user_id: userId,
        tmdb_id: show.tmdbId,
        media_type: "tv",
        status,
        title: details.name,
        poster_path: details.poster_path,
        release_date: details.first_air_date || null,
      },
      { onConflict: "user_id,tmdb_id,media_type" }
    );
    if (libError) {
      console.error(`  ! library_items upsert failed: ${libError.message}`);
      continue;
    }

    const rows = show.episodes.map((e) => ({
      user_id: userId,
      tmdb_show_id: show.tmdbId,
      season_number: e.season,
      episode_number: e.episode,
      watched_at: e.watchedAt,
    }));

    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { data: epData, error: epError } = await supabase
        .from("watched_episodes")
        .upsert(batch, { onConflict: "user_id,tmdb_show_id,season_number,episode_number" })
        .select("id");
      if (epError) {
        console.error(
          `  ! watched_episodes upsert failed (code ${epError.code}): ${epError.message}${epError.details ? ` | details: ${epError.details}` : ""}${epError.hint ? ` | hint: ${epError.hint}` : ""}`
        );
        totalEpisodeErrors += batch.length;
      } else {
        totalEpisodesWritten += epData?.length ?? batch.length;
      }
    }
  }

  console.log(commit ? "\nDone." : "\nDry run complete — rerun with --commit to write these changes.");
  if (commit) {
    console.log(`Episodes written: ${totalEpisodesWritten}, failed: ${totalEpisodeErrors}`);
  }
}

main();
