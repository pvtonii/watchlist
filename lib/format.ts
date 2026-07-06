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

/** "2026-07-10" → "Jul 2026" (no day, for compact library cards). */
export function fmtMonthYear(date: string | null | undefined): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * TV show year range for library cards, e.g. "2019 - Present" (still airing)
 * or "2016 - 2022" (ended). Falls back to a single year when start === end.
 */
export function fmtYearRange(
  firstAirDate: string | null | undefined,
  ended: boolean,
  lastAirDate: string | null | undefined
): string {
  const start = firstAirDate?.slice(0, 4);
  if (!start) return "";
  if (!ended) return `${start} - Present`;
  const end = lastAirDate?.slice(0, 4);
  return end && end !== start ? `${start} - ${end}` : start;
}

/** ISO timestamp (e.g. "2026-07-10T14:32:00Z") → "Jul 10, 2026". */
export function fmtDateTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "TBA";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
