// Recovers "want to watch" movies (title, release date) from the TV Time
// export's tracking-prod-records.csv ("towatch" rows with entity_type "movie").
import fs from "node:fs";
import path from "node:path";
import { readCsvObjects } from "./lib/csv.mjs";

const exportDir = process.argv[2];
if (!exportDir) {
  console.error("Usage: node 12-aggregate-towatch-movies.mjs <path to tv time export folder>");
  process.exit(1);
}

const rows = readCsvObjects(path.join(exportDir, "tracking-prod-records.csv"), fs);

const byKey = new Map();
for (const r of rows) {
  if (r.type !== "towatch" || r.entity_type !== "movie" || !r.movie_name) continue;
  const releaseDate = r.release_date ? r.release_date.slice(0, 10) : null;
  const key = `${r.movie_name}|${releaseDate}`;
  if (!byKey.has(key)) {
    byKey.set(key, { title: r.movie_name, releaseDate });
  }
}

const movies = [...byKey.values()].sort((a, b) => a.title.localeCompare(b.title));

const outPath = path.join(import.meta.dirname, "data", "towatch-movies.json");
fs.writeFileSync(outPath, JSON.stringify({ movies }, null, 2));

console.log(`Want-to-watch movies recovered: ${movies.length}`);
movies.forEach((m) => console.log(`  - ${m.title} (${m.releaseDate})`));
console.log(`\nWritten to ${outPath}`);
