// Matches recovered movies (data/movies.json) to TMDB ids using title +
// release year (TV Time already gives us the exact release date, so this is
// much less ambiguous than the TV show matching).
import fs from "node:fs";
import path from "node:path";
import { loadEnvLocal } from "./lib/env.mjs";

const dataDir = path.join(import.meta.dirname, "data");
loadEnvLocal(path.join(import.meta.dirname, "..", "..", ".env.local"));

const TMDB_API_KEY = process.env.TMDB_API_KEY;

function normalize(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function searchMovie(query, year) {
  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.searchParams.set("query", query);
  url.searchParams.set("language", "en-US");
  if (year) url.searchParams.set("year", year);
  const headers = { accept: "application/json" };
  if (TMDB_API_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${TMDB_API_KEY}`;
  else url.searchParams.set("api_key", TMDB_API_KEY);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  return (await res.json()).results ?? [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { movies } = JSON.parse(fs.readFileSync(path.join(dataDir, "movies.json"), "utf8"));

  const results = [];
  let auto = 0;
  let needsReview = 0;

  for (const m of movies) {
    const year = m.releaseDate ? m.releaseDate.slice(0, 4) : null;

    let candidates = await searchMovie(m.title, year);
    if (candidates.length === 0 && year) {
      // retry without the year filter in case TMDB's year is off by one (region release dates)
      candidates = await searchMovie(m.title, null);
    }
    await sleep(120);

    const norm = normalize(m.title);
    const exact = candidates.filter((c) => normalize(c.title) === norm || normalize(c.original_title) === norm);
    const byExactDate = exact.filter((c) => c.release_date === m.releaseDate);

    let chosen = null;
    let status = "needs_review";
    let reason = "";

    if (byExactDate.length === 1) {
      chosen = byExactDate[0];
      status = "auto";
      reason = "exact title + release date match";
    } else if (exact.length === 1) {
      chosen = exact[0];
      status = "auto";
      reason = "unique title match";
    } else if (exact.length === 0 && candidates.length === 1) {
      chosen = candidates[0];
      status = "auto";
      reason = "unique TMDB result";
    } else {
      const pool = exact.length > 0 ? exact : candidates;
      chosen = [...pool].sort((a, b) => b.popularity - a.popularity)[0];
      reason = "guessed: most popular match";
    }

    if (status === "auto") auto++;
    else needsReview++;

    results.push({
      title: m.title,
      releaseDate: m.releaseDate,
      watchedAt: m.watchedAt,
      status,
      reason,
      chosenTmdbId: chosen?.id ?? null,
      chosenTitle: chosen?.title ?? null,
      chosenReleaseDate: chosen?.release_date ?? null,
      candidates: candidates.slice(0, 5).map((c) => ({
        id: c.id,
        title: c.title,
        release_date: c.release_date,
        popularity: c.popularity,
      })),
    });
  }

  fs.writeFileSync(path.join(dataDir, "movies-match-report.json"), JSON.stringify({ movies: results }, null, 2));

  console.log(`Auto-matched: ${auto}`);
  console.log(`Needs review: ${needsReview}`);
  for (const r of results.filter((r) => r.status === "needs_review")) {
    console.log(`\n- "${r.title}" (${r.releaseDate})`);
    console.log(`    guess: [${r.chosenTmdbId}] ${r.chosenTitle} — ${r.chosenReleaseDate} (${r.reason})`);
    for (const c of r.candidates) console.log(`    [${c.id}] ${c.title} — ${c.release_date}`);
  }
}

main();
