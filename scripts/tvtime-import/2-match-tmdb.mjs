// For every show in episodes-by-show.json, find its TMDB tv id.
// Writes data/match-report.json — a high-confidence match is auto-picked,
// everything else is left for you to fill in by hand before importing.
import fs from "node:fs";
import path from "node:path";
import { loadEnvLocal } from "./lib/env.mjs";

const dataDir = path.join(import.meta.dirname, "data");
loadEnvLocal(path.join(import.meta.dirname, "..", "..", ".env.local"));

const TMDB_API_KEY = process.env.TMDB_API_KEY;
if (!TMDB_API_KEY) {
  console.error("TMDB_API_KEY not found in .env.local");
  process.exit(1);
}

function normalize(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// TV Time appends " (YYYY)" to disambiguate shows that share a title.
function splitYearHint(name) {
  const m = name.match(/^(.*?)\s*\((\d{4})\)$/);
  if (!m) return { query: name, year: null };
  return { query: m[1].trim(), year: Number(m[2]) };
}

async function searchTv(query) {
  const url = new URL("https://api.themoviedb.org/3/search/tv");
  url.searchParams.set("query", query);
  url.searchParams.set("language", "en-US");
  const headers = { accept: "application/json" };
  if (TMDB_API_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${TMDB_API_KEY}`;
  } else {
    url.searchParams.set("api_key", TMDB_API_KEY);
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.results ?? [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { shows } = JSON.parse(
    fs.readFileSync(path.join(dataDir, "episodes-by-show.json"), "utf8")
  );

  const results = [];
  let autoMatched = 0;
  let needsReview = 0;

  for (const show of shows) {
    const { query, year } = splitYearHint(show.name);
    let candidates = [];
    try {
      candidates = await searchTv(query);
    } catch (err) {
      console.error(`  ! TMDB search failed for "${show.name}": ${err.message}`);
    }

    const norm = normalize(query);
    const exact = candidates.filter(
      (c) => normalize(c.name) === norm || normalize(c.original_name) === norm
    );
    const pool = exact.length > 0 ? exact : candidates;

    const earliestWatched = show.episodes[0]?.watchedAt
      ? new Date(show.episodes[0].watchedAt)
      : null;

    let chosen = null;
    let status = "needs_review";
    let reason = "";

    if (exact.length === 1) {
      chosen = exact[0];
      status = "auto";
      reason = "unique name match";
    } else if (exact.length === 0 && candidates.length === 1) {
      chosen = candidates[0];
      status = "auto";
      reason = "unique TMDB result";
    } else if (year && pool.length > 0) {
      const byYear = pool.filter(
        (c) => c.first_air_date && Number(c.first_air_date.slice(0, 4)) === year
      );
      if (byYear.length === 1) {
        chosen = byYear[0];
        status = "auto";
        reason = `matched TV Time's year hint (${year})`;
      }
    }

    if (!chosen && pool.length > 0) {
      // Best guess: prefer a show that already existed before you started
      // watching it, closest to that date; fall back to popularity.
      const withDates = pool.filter((c) => c.first_air_date);
      const plausible = earliestWatched
        ? withDates.filter((c) => new Date(c.first_air_date) <= earliestWatched)
        : withDates;
      const rankSource = plausible.length > 0 ? plausible : pool;
      chosen = [...rankSource].sort((a, b) => {
        if (earliestWatched && a.first_air_date && b.first_air_date) {
          const da = Math.abs(earliestWatched - new Date(a.first_air_date));
          const db = Math.abs(earliestWatched - new Date(b.first_air_date));
          if (da !== db) return da - db;
        }
        return b.popularity - a.popularity;
      })[0];
      reason = earliestWatched
        ? "guessed: closest first-air-date to when you started watching"
        : "guessed: most popular match";
    }

    if (status === "auto") autoMatched++;
    else needsReview++;

    results.push({
      tvtimeId: show.tvtimeId,
      name: show.name,
      nbEpisodesReported: show.nbEpisodesReported,
      nbEpisodesWithDate: show.nbEpisodesWithDate,
      firstWatchedAt: show.episodes[0]?.watchedAt ?? null,
      status,
      reason,
      chosenTmdbId: chosen?.id ?? null,
      chosenTitle: chosen?.name ?? null,
      chosenFirstAirDate: chosen?.first_air_date ?? null,
      candidates: candidates.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        original_name: c.original_name,
        first_air_date: c.first_air_date,
        popularity: c.popularity,
      })),
    });

    await sleep(120);
  }

  fs.writeFileSync(
    path.join(dataDir, "match-report.json"),
    JSON.stringify({ shows: results }, null, 2)
  );

  console.log(`Auto-matched: ${autoMatched}`);
  console.log(`Needs review: ${needsReview}`);
  console.log("\nShows needing review:");
  for (const r of results.filter((r) => r.status === "needs_review")) {
    console.log(
      `\n- "${r.name}" (tvtime id ${r.tvtimeId}, first watched ${r.firstWatchedAt?.slice(0, 10) ?? "?"})`
    );
    console.log(
      `    guess: [${r.chosenTmdbId}] ${r.chosenTitle} — ${r.chosenFirstAirDate || "?"} (${r.reason})`
    );
    if (r.candidates.length === 0) console.log("    no TMDB matches found");
    for (const c of r.candidates) {
      console.log(
        `    [${c.id}] ${c.name}${c.original_name !== c.name ? ` (${c.original_name})` : ""} — ${c.first_air_date || "?"}`
      );
    }
  }
}

main();
