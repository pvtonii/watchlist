/**
 * WatchList — central config (Melhores Práticas: versão num lugar só)
 *
 * A cada mudança: subir APP_VERSION (MAIOR.MENOR.CORREÇÃO) e APP_RELEASE_DATE
 * (data real da entrega). O footer lê daqui automaticamente.
 */
export const APP_NAME = "WatchList";
export const APP_VERSION = "1.4.0";
export const APP_RELEASE_DATE = "2026-07-06";

/** Must match the topbar/background color in globals.css (--bg-deep). */
export const THEME_COLOR = "#0c111b";

/* ---------------- Business rules ----------------
 * - Multi-user: each account only sees its own data (enforced by Supabase RLS).
 * - Library statuses: watchlist | watching | completed | dropped.
 * - Movies: "watched" = status completed (no per-episode tracking).
 * - TV: progress = watched episodes / total episodes (specials/season 0 excluded
 *   from progress math but still listed and trackable).
 * - No ratings in v1 (decided 2026-07-04; may come later).
 */
export const LIBRARY_STATUSES = [
  "watchlist",
  "watching",
  "completed",
  "dropped",
] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

export const STATUS_LABELS: Record<LibraryStatus, string> = {
  watchlist: "Want to Watch",
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
};

/** Progress bar colors on My List TV cards, based on the show's air status. */
export const SHOW_PROGRESS_COLORS = {
  /** Watching/Completed, and the show has ended — no more new episodes. */
  ended: "#9900FF",
  /** Watching/Completed, and the show is still airing/renewed. */
  continuing: "#66CC00",
  /** Dropped. */
  dropped: "#CB9783",
} as const;

/** TMDB `TvDetails.status` values that mean the show won't get new episodes. */
export const ENDED_TV_STATUSES = ["Ended", "Canceled"];

/** Progress bar color for a show, based on your library status + its air status. */
export function showProgressColor(
  libraryStatus: LibraryStatus | undefined,
  tvStatus: string | undefined
): string | undefined {
  if (libraryStatus === "dropped") return SHOW_PROGRESS_COLORS.dropped;
  if (libraryStatus === "watching" || libraryStatus === "completed") {
    const ended = tvStatus ? ENDED_TV_STATUSES.includes(tvStatus) : false;
    return ended ? SHOW_PROGRESS_COLORS.ended : SHOW_PROGRESS_COLORS.continuing;
  }
  return undefined;
}

/* ---------------- TMDB image helpers ---------------- */
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";

export function tmdbPoster(path: string | null, size: "w185" | "w342" | "w500" = "w342") {
  return path ? `${TMDB_IMG_BASE}/${size}${path}` : null;
}

export function tmdbBackdrop(path: string | null, size: "w780" | "w1280" = "w780") {
  return path ? `${TMDB_IMG_BASE}/${size}${path}` : null;
}

export function tmdbProfile(path: string | null) {
  return path ? `${TMDB_IMG_BASE}/w185${path}` : null;
}
