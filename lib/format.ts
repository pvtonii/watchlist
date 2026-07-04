/** "2026-07-10" → "Jul 10, 2026" (UI language: English). */
export function fmtDate(date: string | null | undefined): string {
  if (!date) return "TBA";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "2026-07-10" → "Jul 10" (short, for lists). */
export function fmtDateShort(date: string | null | undefined): string {
  if (!date) return "TBA";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function seasonEpisodeLabel(season: number, episode: number): string {
  return `S${season} · E${episode}`;
}
