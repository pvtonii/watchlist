// Shows that were followed on TV Time but never had an episode watched
// (0 recovered dates). These get added to the library as "watchlist" (Want to
// Watch) — no episodes to import, just the library_items row.
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
const skippedHasEpisodes = [];
const skippedManual = [];
const skippedUnresolved = [];

for (const m of matchData) {
  const eps = episodesById.get(m.tvtimeId);
  if (eps && eps.episodes.length > 0) {
    skippedHasEpisodes.push(m.name);
    continue;
  }

  const override = overrides[m.tvtimeId];
  if (override?.skip) {
    skippedManual.push({ name: m.name, reason: override.reason });
    continue;
  }

  const tmdbId = override?.tmdbId ?? m.chosenTmdbId;
  const title = override?.title ?? m.chosenTitle;
  if (!tmdbId) {
    skippedUnresolved.push(m.name);
    continue;
  }

  resolved.push({ tvtimeId: m.tvtimeId, tvtimeName: m.name, tmdbId, title, overridden: Boolean(override) });
}

fs.writeFileSync(
  path.join(dataDir, "resolved-followed.json"),
  JSON.stringify({ shows: resolved }, null, 2)
);

console.log(`Resolved (Want to Watch): ${resolved.length} shows`);
if (skippedManual.length > 0) {
  console.log(`Skipped (manual review needed): ${skippedManual.length}`);
  skippedManual.forEach((s) => console.log(`  - ${s.name}: ${s.reason}`));
}
if (skippedUnresolved.length > 0) {
  console.log(`Skipped (no TMDB id found): ${skippedUnresolved.length}`);
  skippedUnresolved.forEach((n) => console.log(`  - ${n}`));
}
