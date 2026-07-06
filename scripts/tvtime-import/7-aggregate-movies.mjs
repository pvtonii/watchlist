// Recovers watched movies (title, release date, watched date) from the
// TV Time export's tracking-prod-records.csv ("watch" rows with entity_type
// "movie").
import fs from "node:fs";
import path from "node:path";
import { readCsvObjects } from "./lib/csv.mjs";

const exportDir = process.argv[2];
if (!exportDir) {
  console.error("Usage: node 7-aggregate-movies.mjs <path to tv time export folder>");
  process.exit(1);
}

const rows = readCsvObjects(path.join(exportDir, "tracking-prod-records.csv"), fs);

// Keyed by title + release date, not just title — e.g. "How to Train Your
// Dragon" (2010 animated) and its 2025 live-action remake share a name.
const byKey = new Map();
for (const r of rows) {
  if (r.type !== "watch" || r.entity_type !== "movie" || !r.movie_name) continue;
  const date = new Date(r.created_at.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) continue;

  const releaseDate = r.release_date ? r.release_date.slice(0, 10) : null;
  const key = `${r.movie_name}|${releaseDate}`;
  const existing = byKey.get(key);
  if (!existing || date < new Date(existing.watchedAt)) {
    byKey.set(key, {
      title: r.movie_name,
      releaseDate,
      watchedAt: date.toISOString(),
    });
  }
}

const movies = [...byKey.values()].sort((a, b) => a.title.localeCompare(b.title));

const outPath = path.join(import.meta.dirname, "data", "movies.json");
fs.writeFileSync(outPath, JSON.stringify({ movies }, null, 2));

console.log(`Movies recovered: ${movies.length}`);
movies.forEach((m) => console.log(`  - ${m.title} (${m.releaseDate}) watched ${m.watchedAt.slice(0, 10)}`));
console.log(`\nWritten to ${outPath}`);
