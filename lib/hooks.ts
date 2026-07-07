"use client";

import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useQueries,
} from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { deriveTvLibraryStatus, type LibraryStatus } from "@/lib/config";
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

/** All watched-episode rows for the user. Paginated: Supabase caps a single
 * request at 1000 rows, and heavy users can pass that. */
export function useWatchedEpisodes() {
  return useQuery<WatchedEpisode[]>({
    queryKey: ["watched-episodes"],
    queryFn: async () => {
      const supabase = getSupabase();
      const pageSize = 1000;
      const rows: WatchedEpisode[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("watched_episodes")
          .select("tmdb_show_id, season_number, episode_number, watched_at")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        rows.push(...(data as WatchedEpisode[]));
        if (data.length < pageSize) break;
      }
      return rows;
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

/** most recent watched_at per show id (excludes specials / season 0, like watchedCountByShow). */
export function lastWatchedByShow(rows: WatchedEpisode[] | undefined) {
  const map = new Map<number, string>();
  for (const row of rows ?? []) {
    if (row.season_number === 0) continue;
    const existing = map.get(row.tmdb_show_id);
    if (!existing || row.watched_at > existing) {
      map.set(row.tmdb_show_id, row.watched_at);
    }
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

/* ---------------- Status reconciliation ---------------- */

/**
 * Re-checks every "watching"/"completed" TV show against live TMDB data and
 * corrects the library status if it's stale — most importantly, flips a
 * "completed" (caught up) show back to "watching" once a new episode has
 * actually been released since the last check. Mount this once app-wide
 * (see components/tv-status-sync.tsx) rather than trusting the stored status
 * on its own, since nothing pushes us an update when a new episode airs.
 */
export function useSyncTvStatuses() {
  const { data: library } = useLibrary();
  const { data: watched } = useWatchedEpisodes();
  const setStatus = useSetStatus();

  const trackedIds = (library ?? [])
    .filter(
      (i) =>
        i.media_type === "tv" &&
        (i.status === "watching" || i.status === "completed")
    )
    .map((i) => i.tmdb_id);
  const detailQueries = useTvDetailsMany(trackedIds);
  const counts = watchedCountByShow(watched);
  const showsLoaded = detailQueries.map((q) => q.data);

  useEffect(() => {
    if (!library) return;
    for (const show of showsLoaded) {
      if (!show) continue;
      const item = library.find(
        (i) => i.tmdb_id === show.id && i.media_type === "tv"
      );
      if (!item) continue;
      const seen = counts.get(show.id) ?? 0;
      const nextStatus = deriveTvLibraryStatus(seen, show);
      if (item.status === nextStatus) continue;
      setStatus.mutate({
        tmdb_id: show.id,
        media_type: "tv",
        status: nextStatus,
        title: show.name,
        poster_path: show.poster_path,
        release_date: show.first_air_date || null,
      });
    }
  }, [library, showsLoaded, counts, setStatus]);
}
