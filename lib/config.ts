/**
 * WatchList — central config (Melhores Práticas: versão num lugar só)
 *
 * A cada mudança: subir APP_VERSION (MAIOR.MENOR.CORREÇÃO) e APP_RELEASE_DATE
 * (data real da entrega). O footer lê daqui automaticamente.
 */
import type { MovieDetails, TvDetails } from "./tmdb-types";
import { fmtDate } from "./format";

export const APP_NAME = "WatchList";
export const APP_VERSION = "1.18.3";
export const APP_RELEASE_DATE = "2026-07-10";

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
  dropped: "Stopped",
};

/** Progress bar colors on My List TV cards, based on the show's air status. */
export const SHOW_PROGRESS_COLORS = {
  /** Watching/Completed, and the show has ended — no more new episodes. */
  ended: "#9900FF",
  /** Watching/Completed, and the show is still airing/renewed. */
  continuing: "#66CC00",
  /** Stopped. Netflix red. */
  dropped: "#E50914",
} as const;

/** TMDB `TvDetails.status` values that mean the show won't get new episodes. */
export const ENDED_TV_STATUSES = ["Ended", "Canceled"];

/** Regular (non-specials) episode total for a show. */
export function regularEpisodeTotal(show: TvDetails): number {
  return show.seasons
    .filter((s) => s.season_number > 0)
    .reduce((sum, s) => sum + s.episode_count, 0);
}

/**
 * Regular episodes actually released so far, based on `last_episode_to_air`.
 * Unlike `regularEpisodeTotal`, this doesn't overcount an in-progress season
 * whose full episode count TMDB already lists before every episode has aired.
 */
export function releasedEpisodeCount(show: TvDetails): number {
  const last = show.last_episode_to_air;
  if (!last || last.season_number <= 0) return 0;
  const priorSeasons = show.seasons
    .filter((s) => s.season_number > 0 && s.season_number < last.season_number)
    .reduce((sum, s) => sum + s.episode_count, 0);
  return priorSeasons + last.episode_number;
}

/**
 * Derives whether a TV show is "completed" (caught up on every regular
 * episode released so far) or "watching" (still has a backlog). This is
 * intentionally re-evaluated against live TMDB data every time it's called
 * (never just trusted from a stored flag) — a show that was fully caught up
 * yesterday may have a new episode out today, which should flip it back to
 * "watching" the next time anything checks.
 */
export function deriveTvLibraryStatus(
  seenCount: number,
  show: TvDetails
): "watching" | "completed" {
  const released = releasedEpisodeCount(show);
  return released > 0 && seenCount >= released ? "completed" : "watching";
}

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

/**
 * Region used for "where to watch" / "in theaters" lookups (TMDB's
 * watch-provider and release-dates data is region-specific).
 */
export const AVAILABILITY_REGION = "US";

/** ~how long after a theatrical release we still call it "Theaters". */
const THEATERS_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * TMDB lists every tier/reseller of a service as its own provider (e.g.
 * "Netflix" AND "Netflix Standard with Ads", "HBO Max" AND "HBO Max Amazon
 * Channel") — strips those suffixes down to the plain brand name so the
 * same service doesn't show up twice under different labels.
 */
function cleanProviderName(name: string): string {
  return name
    .replace(/\s+(Amazon|Roku(?:\s+Premium)?|Apple\s?TV)\s+Channel$/i, "")
    .replace(/\s+(?:(?:Basic|Standard)\s+)?with Ads$/i, "")
    .replace(/\s+(Premium|Essential|Standard|Basic)$/i, "")
    .replace(/\s+Plus$/i, "+")
    .trim();
}

/** De-dupes cleaned provider names case-insensitively, keeping first-seen casing. */
function uniqueProviderNames(providers: { provider_name: string }[]): string[] {
  const seen = new Map<string, string>();
  for (const p of providers) {
    const cleaned = cleanProviderName(p.provider_name);
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) seen.set(key, cleaned);
  }
  return Array.from(seen.values());
}

export type MovieAvailability =
  | { kind: "upcoming"; label: string }
  | { kind: "theaters"; label: string }
  | { kind: "streaming"; label: string }
  | { kind: "released"; label: string }
  | { kind: "unknown" };

/**
 * Best-effort "where does this movie stand right now" — upcoming release,
 * still in theaters, streaming somewhere, or just released with no further
 * signal. TMDB's coverage of watch-provider/release-type data isn't
 * complete for every title, so this always falls back to the plain release
 * date rather than guessing.
 */
export function movieAvailability(movie: MovieDetails): MovieAvailability {
  const releaseDate = movie.release_date || null;
  if (!releaseDate) return { kind: "unknown" };

  const now = Date.now();
  const releaseTime = new Date(`${releaseDate}T12:00:00`).getTime();
  if (!Number.isNaN(releaseTime) && releaseTime > now) {
    return { kind: "upcoming", label: `Releases ${fmtDate(releaseDate)}` };
  }

  const providers = movie.watch_providers?.results?.[AVAILABILITY_REGION];
  const streamProviders = providers?.flatrate ?? providers?.rent ?? providers?.buy;
  if (streamProviders && streamProviders.length > 0) {
    const names = uniqueProviderNames(streamProviders).slice(0, 2);
    return { kind: "streaming", label: names.join(", ") };
  }

  const regionReleases = movie.release_dates?.results?.find(
    (r) => r.iso_3166_1 === AVAILABILITY_REGION
  )?.release_dates;
  // type 2 = limited theatrical, 3 = theatrical, 4 = digital, 6 = TV.
  const theatrical = regionReleases
    ?.filter((r) => r.type === 2 || r.type === 3)
    .sort((a, b) => b.release_date.localeCompare(a.release_date))[0];
  const hasDigitalOrTv = regionReleases?.some((r) => r.type === 4 || r.type === 6);
  if (theatrical && !hasDigitalOrTv) {
    const theatricalTime = new Date(theatrical.release_date).getTime();
    if (!Number.isNaN(theatricalTime) && now - theatricalTime <= THEATERS_WINDOW_MS) {
      return { kind: "theaters", label: "Theaters" };
    }
  }

  return { kind: "released", label: `Released ${fmtDate(releaseDate)}` };
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
