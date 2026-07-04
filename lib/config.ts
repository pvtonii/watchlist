/**
 * WatchList — central config (Melhores Práticas: versão num lugar só)
 *
 * A cada mudança: subir APP_VERSION (MAIOR.MENOR.CORREÇÃO) e APP_RELEASE_DATE
 * (data real da entrega). O footer lê daqui automaticamente.
 */
export const APP_NAME = "WatchList";
export const APP_VERSION = "1.0.0";
export const APP_RELEASE_DATE = "2026-07-04";

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
