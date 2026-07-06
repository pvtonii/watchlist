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
  watchedCountByShow,
  watchedDateByEpisode,
} from "@/lib/hooks";
import { fmtDateShort, fmtDateTime } from "@/lib/format";
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

  const watchedDates = watchedDateByEpisode(watched, showId, seasonNumber);

  const episodes = data?.episodes ?? [];
  const allWatched = episodes.length > 0 && watchedSet.size >= episodes.length;
  const today = new Date().toISOString().slice(0, 10);

  const totalRegularEpisodes = show
    ? show.seasons
        .filter((s) => s.season_number > 0)
        .reduce((sum, s) => sum + s.episode_count, 0)
    : 0;
  const showWatchedCount = watchedCountByShow(watched).get(showId) ?? 0;

  /**
   * Keeps the show's library status honest with real progress: full regular-episode
   * count → Completed, anything less → Watching (Want to Watch/Dropped/no entry all
   * resume into Watching once you touch an episode). Specials (season 0) never drive
   * this — they're excluded from the progress math everywhere else too.
   */
  function syncShowStatus(newShowWatchedCount: number) {
    if (!show || seasonNumber === 0) return;
    const inLibrary = library?.find(
      (i) => i.tmdb_id === showId && i.media_type === "tv"
    );
    const isFullyWatched =
      totalRegularEpisodes > 0 && newShowWatchedCount >= totalRegularEpisodes;
    const nextStatus = isFullyWatched ? "completed" : "watching";
    if (inLibrary?.status === nextStatus) return;

    setStatus.mutate({
      tmdb_id: showId,
      media_type: "tv",
      status: nextStatus,
      title: show.name,
      poster_path: show.poster_path,
      release_date: show.first_air_date || null,
    });
  }

  function handleToggle(episodeNumber: number) {
    const watchedNow = watchedSet.has(episodeNumber);
    const newWatched = !watchedNow;
    toggleEpisode.mutate({
      tmdb_show_id: showId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
      watched: newWatched,
    });
    syncShowStatus(showWatchedCount + (newWatched ? 1 : -1));
  }

  function handleMarkAll() {
    const newSeasonCount = allWatched ? 0 : episodes.length;
    markSeason.mutate({
      tmdb_show_id: showId,
      season_number: seasonNumber,
      episode_numbers: episodes.map((e) => e.episode_number),
      watched: !allWatched,
    });
    syncShowStatus(showWatchedCount + (newSeasonCount - watchedSet.size));
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
                      {isWatched && (
                        <p className="text-[11px] text-primary">
                          Watched {fmtDateTime(watchedDates.get(ep.episode_number))}
                        </p>
                      )}
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
