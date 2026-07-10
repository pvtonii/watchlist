/** Shapes of the TMDB data our API routes return (subset of the full API). */

export type MediaType = "movie" | "tv";

export interface TmdbListItem {
  id: number;
  media_type?: MediaType;
  title?: string; // movies
  name?: string; // tv
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string; // movies
  first_air_date?: string; // tv
  vote_average?: number;
}

export interface TmdbSearchResponse {
  results: TmdbListItem[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface WatchProviderEntry {
  provider_name: string;
}

export interface WatchProvidersResponse {
  results: Record<
    string,
    {
      link: string;
      flatrate?: WatchProviderEntry[];
      rent?: WatchProviderEntry[];
      buy?: WatchProviderEntry[];
    }
  >;
}

export interface ReleaseDatesResponse {
  results: {
    iso_3166_1: string;
    release_dates: { type: number; release_date: string }[];
  }[];
}

export interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  credits?: { cast: CastMember[] };
  /** Re-keyed from TMDB's `"watch/providers"` field by our API route. */
  watch_providers?: WatchProvidersResponse;
  release_dates?: ReleaseDatesResponse;
}

export interface SeasonSummary {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
  air_date: string | null;
}

export interface EpisodeStub {
  season_number: number;
  episode_number: number;
  name: string;
  air_date: string | null;
}

export interface TvDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  status: string; // "Returning Series" | "Ended" | ...
  number_of_seasons: number;
  number_of_episodes: number;
  genres: { id: number; name: string }[];
  networks: { id: number; name: string; logo_path: string | null }[];
  seasons: SeasonSummary[];
  next_episode_to_air: EpisodeStub | null;
  last_episode_to_air: EpisodeStub | null;
  /** Typical episode length(s) in minutes, per TMDB (often a single value). */
  episode_run_time: number[];
  credits?: { cast: CastMember[] };
}

export interface Episode {
  id: number;
  season_number: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
}

export interface SeasonDetails {
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  episodes: Episode[];
}

export function itemTitle(item: TmdbListItem): string {
  return item.title ?? item.name ?? "Untitled";
}

export function itemDate(item: TmdbListItem): string | undefined {
  return item.release_date ?? item.first_air_date;
}

export function itemYear(item: TmdbListItem): string {
  const d = itemDate(item);
  return d ? d.slice(0, 4) : "";
}
