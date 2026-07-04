"use client";

import { use, useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import Topbar from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLibrary,
  useSetStatus,
  useTmdb,
  useToggleEpisode,
  useMarkSeason,
  useWatchedEpisodes,
} from "@/lib/hooks";
import { fmtDateShort } from "@/lib/format";
import type { SeasonDetails, TvDetails } from "@/lib/tmdb-types";

export default function SeasonPage({
  params,
}: {
  params: Promise<{ id: string; season: string }>;
}) {
  const { id, season } = use(params);
  const showId = Number(id);
  const seasonNumber = Number(season);

  const { data, isLoading, error } = useTmdb<SeasonDetails>(
    `/tv/${id}/season/${season}`
  );
  const { data: show } = useTmdb<TvDetails>(`/tv/${id}`);
  const { data: watched } = useWatchedEpisodes();
  const { data: library } = useLibrary();
  const toggleEpisode = useToggleEpisode();
  const markSeason = useMarkSeason();
  const setStatus = useSetStatus();

  const watchedSet = useMemo(
    () =>
      new Set(
        (watched ?? [])
          .filter(
            (w) =>
              w.tmdb_show_id === showId && w.season_number === seasonNumber
          )
          .map((w) => w.episode_number)
      ),
    [watched, showId, seasonNumber]
  );

  const episodes = data?.episodes ?? [];
  const allWatched = episodes.length > 0 && watchedSet.size >= episodes.length;
  const today = new Date().toISOString().slice(0, 10);

  /** Marcar algo assistido adiciona a série como "Watching" se não estiver na lista. */
  function ensureInLibrary() {
    const inLibrary = library?.some(
      (i) => i.tmdb_id === showId && i.media_type === "tv"
    );
    if (!inLibrary && show) {
      setStatus.mutate({
        tmdb_id: showId,
        media_type: "tv",
        status: "watching",
        title: show.name,
        poster_path: show.poster_path,
        release_date: show.first_air_date || null,
      });
    }
  }

  function handleToggle(episodeNumber: number) {
    const watchedNow = watchedSet.has(episodeNumber);
    if (!watchedNow) ensureInLibrary();
    toggleEpisode.mutate({
      tmdb_show_id: showId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
      watched: !watchedNow,
    });
  }

  function handleMarkAll() {
    if (!allWatched) ensureInLibrary();
    markSeason.mutate({
      tmdb_show_id: showId,
      season_number: seasonNumber,
      episode_numbers: episodes.map((e) => e.episode_number),
      watched: !allWatched,
    });
  }

  return (
    <>
      <Topbar title={data?.name ?? `Season ${seasonNumber}`} back />
      <main className="content flex flex-col gap-4 pt-2">
        {isLoading && <Skeleton className="h-60 w-full" />}
        {error && (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        )}

        {episodes.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {watchedSet.size}/{episodes.length} watched
              </p>
              <Button
                size="sm"
                variant={allWatched ? "secondary" : "default"}
                disabled={markSeason.isPending}
                onClick={handleMarkAll}
                className="font-bold"
              >
                {allWatched ? "Unmark all" : "Mark all watched"}
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              {episodes.map((ep) => {
                const isWatched = watchedSet.has(ep.episode_number);
                const unaired = !ep.air_date || ep.air_date > today;
                return (
                  <div
                    key={ep.id}
                    className={`flex items-center gap-3 rounded-xl bg-card p-3 ${
                      unaired ? "opacity-55" : ""
                    }`}
                  >
                    <button
                      onClick={() => handleToggle(ep.episode_number)}
                      disabled={toggleEpisode.isPending}
                      aria-label={
                        isWatched ? "Mark as unwatched" : "Mark as watched"
                      }
                      className="shrink-0"
                    >
                      {isWatched ? (
                        <CheckCircle2 size={26} className="text-primary" />
                      ) : (
                        <Circle size={26} className="text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {ep.episode_number}. {ep.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDateShort(ep.air_date)}
                        {ep.runtime ? ` · ${ep.runtime} min` : ""}
                        {unaired ? " · not aired yet" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </>
  );
}
