"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  useQueries,
} from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { LibraryStatus } from "@/lib/config";
import type { MediaType, MovieDetails, TvDetails } from "@/lib/tmdb-types";

/* ---------------- Types (DB rows) ---------------- */

export interface LibraryItem {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  status: LibraryStatus;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface WatchedEpisode {
  tmdb_show_id: number;
  season_number: number;
  episode_number: number;
  watched_at: string;
}

/* ---------------- TMDB (via our API routes) ---------------- */

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function useTmdb<T>(path: string | null) {
  return useQuery<T>({
    queryKey: ["tmdb", path],
    enabled: path !== null,
    queryFn: () => fetchJson<T>(`/api/tmdb${path}`),
  });
}

/** Details of several TV shows at once (Home / Library progress). */
export function useTvDetailsMany(ids: number[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ["tmdb", `/tv/${id}`],
      queryFn: () => fetchJson<TvDetails>(`/api/tmdb/tv/${id}`),
      staleTime: 15 * 60_000,
    })),
  });
}

/** Details of several movies at once (Library genre/year). */
export function useMovieDetailsMany(ids: number[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ["tmdb", `/movie/${id}`],
      queryFn: () => fetchJson<MovieDetails>(`/api/tmdb/movie/${id}`),
      staleTime: 15 * 60_000,
    })),
  });
}

/* ---------------- Library ---------------- */

export function useLibrary() {
  return useQuery<LibraryItem[]>({
    queryKey: ["library"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("library_items")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as LibraryItem[];
    },
  });
}

export interface SetStatusInput {
  tmdb_id: number;
  media_type: MediaType;
  status: LibraryStatus;
  title: string;
  poster_path: string | null;
  release_date: string | null;
}

export function useSetStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetStatusInput) => {
      const supabase = getSupabase();
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("library_items").upsert(
        { ...input, user_id: userData.user.id },
        { onConflict: "user_id,tmdb_id,media_type" }
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });
}

export function useRemoveFromLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tmdb_id: number; media_type: MediaType }) => {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("library_items")
        .delete()
        .eq("tmdb_id", input.tmdb_id)
        .eq("media_type", input.media_type);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });
}

/* ---------------- Watched episodes ---------------- */

/** All watched-episode rows for the user (cheap at personal scale). */
export function useWatchedEpisodes() {
  return useQuery<WatchedEpisode[]>({
    queryKey: ["watched-episodes"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("watched_episodes")
        .select("tmdb_show_id, season_number, episode_number, watched_at");
      if (error) throw error;
      return data as WatchedEpisode[];
    },
  });
}

export function useToggleEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tmdb_show_id: number;
      season_number: number;
      episode_number: number;
      watched: boolean;
    }) => {
      const supabase = getSupabase();
      if (input.watched) {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError || !userData.user) throw new Error("Not signed in");
        const { error } = await supabase.from("watched_episodes").upsert(
          {
            user_id: userData.user.id,
            tmdb_show_id: input.tmdb_show_id,
            season_number: input.season_number,
            episode_number: input.episode_number,
          },
          {
            onConflict: "user_id,tmdb_show_id,season_number,episode_number",
            ignoreDuplicates: true,
          }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("watched_episodes")
          .delete()
          .eq("tmdb_show_id", input.tmdb_show_id)
          .eq("season_number", input.season_number)
          .eq("episode_number", input.episode_number);
        if (error) throw error;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["watched-episodes"] }),
  });
}

/** Mark/unmark a whole season at once. */
export function useMarkSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tmdb_show_id: number;
      season_number: number;
      episode_numbers: number[];
      watched: boolean;
    }) => {
      const supabase = getSupabase();
      if (input.watched) {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError || !userData.user) throw new Error("Not signed in");
        const rows = input.episode_numbers.map((episode_number) => ({
          user_id: userData.user.id,
          tmdb_show_id: input.tmdb_show_id,
          season_number: input.season_number,
          episode_number,
        }));
        const { error } = await supabase.from("watched_episodes").upsert(rows, {
          onConflict: "user_id,tmdb_show_id,season_number,episode_number",
          ignoreDuplicates: true,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("watched_episodes")
          .delete()
          .eq("tmdb_show_id", input.tmdb_show_id)
          .eq("season_number", input.season_number);
        if (error) throw error;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["watched-episodes"] }),
  });
}

/* ---------------- Derived helpers ---------------- */

/** watched count per show id (excludes specials / season 0). */
export function watchedCountByShow(rows: WatchedEpisode[] | undefined) {
  const map = new Map<number, number>();
  for (const row of rows ?? []) {
    if (row.season_number === 0) continue;
    map.set(row.tmdb_show_id, (map.get(row.tmdb_show_id) ?? 0) + 1);
  }
  return map;
}

/** watched count per season for one show. */
export function watchedCountBySeason(
  rows: WatchedEpisode[] | undefined,
  showId: number
) {
  const map = new Map<number, number>();
  for (const row of rows ?? []) {
    if (row.tmdb_show_id !== showId) continue;
    map.set(row.season_number, (map.get(row.season_number) ?? 0) + 1);
  }
  return map;
}

/** watched_at per episode number, for one show/season. */
export function watchedDateByEpisode(
  rows: WatchedEpisode[] | undefined,
  showId: number,
  seasonNumber: number
) {
  const map = new Map<number, string>();
  for (const row of rows ?? []) {
    if (row.tmdb_show_id !== showId || row.season_number !== seasonNumber)
      continue;
    map.set(row.episode_number, row.watched_at);
  }
  return map;
}
