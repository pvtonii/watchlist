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

/**
 * Total minutes → "2mo 14d 6h" (TV Time-style watch-time stat). Drops
 * leading zero units (a new user just sees "6h", not "0mo 0d 6h"), but a
 * unit stays visible once a bigger one kicks in (e.g. "14d 0h").
 */
export function fmtWatchDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  const months = Math.floor(totalHours / (24 * 30));
  const daysRemainder = totalHours - months * 24 * 30;
  const days = Math.floor(daysRemainder / 24);
  const hours = daysRemainder % 24;

  const parts: string[] = [];
  if (months > 0) parts.push(`${months}mo`);
  if (months > 0 || days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h`);
  return parts.join(" ");
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
