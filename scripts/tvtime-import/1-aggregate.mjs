// Reads a TV Time GDPR data export and builds one JSON file per show with
// the earliest known "watched" timestamp per (season, episode).
//
// Usage: node scripts/tvtime-import/1-aggregate.mjs "/path/to/tv time export"
import fs from "node:fs";
import path from "node:path";
import { readCsvObjects } from "./lib/csv.mjs";

const exportDir = process.argv[2];
if (!exportDir) {
  console.error("Usage: node 1-aggregate.mjs <path to tv time export folder>");
  process.exit(1);
}

function file(name) {
  return path.join(exportDir, name);
}

// tv_show_id -> { name, nbEpisodesReported }
const showsById = new Map();
for (const r of readCsvObjects(file("user_tv_show_data.csv"), fs)) {
  showsById.set(r.tv_show_id, {
    name: r.tv_show_name,
    nbEpisodesReported: Number(r.nb_episodes_seen) || 0,
  });
}

// name -> tv_show_id (for sources that only carry the name, e.g. seen_episode_source.csv)
const idByName = new Map();
for (const [id, s] of showsById) idByName.set(s.name, id);

// tv_show_id -> Map("season|episode" -> earliest ISO date)
const episodesByShow = new Map();
function ensureShow(id) {
  if (!episodesByShow.has(id)) episodesByShow.set(id, new Map());
  return episodesByShow.get(id);
}
function record(id, season, episode, createdAtRaw) {
  if (!id || !showsById.has(id)) return;
  season = Number(season);
  episode = Number(episode);
  if (!Number.isFinite(season) || !Number.isFinite(episode)) return;
  const date = new Date(createdAtRaw.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return;

  const map = ensureShow(id);
  const key = `${season}|${episode}`;
  const existing = map.get(key);
  if (!existing || date < new Date(existing)) {
    map.set(key, date.toISOString());
  }
}

// Source 1: tracking-prod-records.csv, type === "watch"
for (const r of readCsvObjects(file("tracking-prod-records.csv"), fs)) {
  if (r.type !== "watch") continue;
  record(r.series_id, r.season_number, r.episode_number, r.created_at);
}

// Source 2: tracking-prod-records-v2.csv, key starts with "watch-episode-"
for (const r of readCsvObjects(file("tracking-prod-records-v2.csv"), fs)) {
  if (!r.key || !r.key.startsWith("watch-episode-")) continue;
  record(r.s_id, r.season_number, r.episode_number, r.created_at);
}

// Source 3: seen_episode_source.csv (older data, keyed by show name)
for (const r of readCsvObjects(file("seen_episode_source.csv"), fs)) {
  const id = idByName.get(r.tv_show_name);
  record(id, r.episode_season_number, r.episode_number, r.created_at);
}

// Source 4: watched_on_episode.csv (rare, "watched on X" notes)
for (const r of readCsvObjects(file("watched_on_episode.csv"), fs)) {
  const id = idByName.get(r.tv_show_name);
  record(id, r.episode_season_number, r.episode_number, r.created_at);
}

const shows = [...showsById.entries()]
  .map(([tvtimeId, info]) => {
    const epMap = episodesByShow.get(tvtimeId) ?? new Map();
    const episodes = [...epMap.entries()]
      .map(([key, watchedAt]) => {
        const [season, episode] = key.split("|").map(Number);
        return { season, episode, watchedAt };
      })
      .sort((a, b) => a.season - b.season || a.episode - b.episode);
    return {
      tvtimeId,
      name: info.name,
      nbEpisodesReported: info.nbEpisodesReported,
      nbEpisodesWithDate: episodes.length,
      episodes,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const outPath = path.join(import.meta.dirname, "data", "episodes-by-show.json");
fs.writeFileSync(outPath, JSON.stringify({ shows }, null, 2));

const totalReported = shows.reduce((s, x) => s + x.nbEpisodesReported, 0);
const totalWithDate = shows.reduce((s, x) => s + x.nbEpisodesWithDate, 0);
const missingDates = shows.filter((s) => s.nbEpisodesWithDate < s.nbEpisodesReported);

console.log(`Shows: ${shows.length}`);
console.log(`Episodes reported by TV Time: ${totalReported}`);
console.log(`Episodes with a recovered date: ${totalWithDate}`);
console.log(`Shows missing some dates: ${missingDates.length}`);
for (const s of missingDates) {
  console.log(
    `  - ${s.name}: ${s.nbEpisodesWithDate}/${s.nbEpisodesReported}`
  );
}
console.log(`\nWritten to ${outPath}`);
