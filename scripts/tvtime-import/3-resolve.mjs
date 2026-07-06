// Merges episodes-by-show.json + match-report.json + manual overrides.json
// into the final list that 4-import.mjs will write to Supabase.
// Skips shows with 0 watched episodes (followed but never watched) and
// anything still unresolved after overrides.
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(import.meta.dirname, "data");

const { shows: episodeData } = JSON.parse(
  fs.readFileSync(path.join(dataDir, "episodes-by-show.json"), "utf8")
);
const { shows: matchData } = JSON.parse(
  fs.readFileSync(path.join(dataDir, "match-report.json"), "utf8")
);
const { overrides } = JSON.parse(
  fs.readFileSync(path.join(dataDir, "overrides.json"), "utf8")
);

const episodesById = new Map(episodeData.map((s) => [s.tvtimeId, s]));

const resolved = [];
const skippedNoEpisodes = [];
const skippedUnresolved = [];
const skippedManual = [];

for (const m of matchData) {
  const eps = episodesById.get(m.tvtimeId);
  if (!eps || eps.episodes.length === 0) {
    skippedNoEpisodes.push(m.name);
    continue;
  }

  const override = overrides[m.tvtimeId];

  if (override?.skip) {
    skippedManual.push({ name: m.name, reason: override.reason });
    continue;
  }

  if (override?.splitBySeason) {
    for (const [seasonStr, target] of Object.entries(override.splitBySeason)) {
      const season = Number(seasonStr);
      const seasonEpisodes = eps.episodes
        .filter((e) => e.season === season)
        .map((e) => ({ season: 1, episode: e.episode, watchedAt: e.watchedAt }));
      if (seasonEpisodes.length === 0) continue;
      resolved.push({
        tvtimeId: `${m.tvtimeId}-s${season}`,
        tvtimeName: `${m.name} (season ${season})`,
        tmdbId: target.tmdbId,
        title: target.title,
        overridden: true,
        episodes: seasonEpisodes,
      });
    }
    continue;
  }

  const tmdbId = override?.tmdbId ?? m.chosenTmdbId;
  const title = override?.title ?? m.chosenTitle;

  if (!tmdbId) {
    skippedUnresolved.push(m.name);
    continue;
  }

  resolved.push({
    tvtimeId: m.tvtimeId,
    tvtimeName: m.name,
    tmdbId,
    title,
    overridden: Boolean(override),
    episodes: eps.episodes, // [{season, episode, watchedAt}]
  });
}

fs.writeFileSync(
  path.join(dataDir, "resolved-shows.json"),
  JSON.stringify({ shows: resolved }, null, 2)
);

console.log(`Resolved: ${resolved.length} shows, ${resolved.reduce((n, s) => n + s.episodes.length, 0)} episodes`);
console.log(`Skipped (0 episodes watched / followed only): ${skippedNoEpisodes.length}`);
if (skippedManual.length > 0) {
  console.log(`Skipped (manual review needed): ${skippedManual.length}`);
  skippedManual.forEach((s) => console.log(`  - ${s.name}: ${s.reason}`));
}
if (skippedUnresolved.length > 0) {
  console.log(`Skipped (still unresolved, no TMDB id): ${skippedUnresolved.length}`);
  skippedUnresolved.forEach((n) => console.log(`  - ${n}`));
}
