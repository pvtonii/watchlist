"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ChevronRight, CalendarClock, Trash2 } from "lucide-react";
import Topbar from "@/components/topbar";
import DetailHeader from "@/components/detail-header";
import CastRow from "@/components/cast-row";
import ProgressBar from "@/components/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useLibrary,
  useSetStatus,
  useRemoveFromLibrary,
  useTmdb,
  useWatchedEpisodes,
  useMarkSeason,
  watchedCountBySeason,
} from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
import {
  STATUS_LABELS,
  showProgressColor,
  type LibraryStatus,
} from "@/lib/config";
import { seasonEpisodeLabel } from "@/lib/format";
import type { TvDetails } from "@/lib/tmdb-types";

// "Watching" is derived automatically from episode progress, never tapped directly.
const MANUAL_TV_STATUSES: readonly LibraryStatus[] = [
  "watchlist",
  "completed",
  "dropped",
];

export default function TvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const showId = Number(id);

  const { data: show, isLoading, error } = useTmdb<TvDetails>(`/tv/${id}`);
  const { data: library } = useLibrary();
  const { data: watched } = useWatchedEpisodes();
  const setStatus = useSetStatus();
  const removeItem = useRemoveFromLibrary();
  const markSeason = useMarkSeason();
  const [confirmCompletedOpen, setConfirmCompletedOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const item = library?.find(
    (i) => i.tmdb_id === showId && i.media_type === "tv"
  );
  const busy = setStatus.isPending || removeItem.isPending || markSeason.isPending;
  const seasonCounts = watchedCountBySeason(watched, showId);
  const barColor = showProgressColor(item?.status, show?.status);

  const regularSeasons =
    show?.seasons
      .filter((s) => s.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number) ?? [];
  const specials = show?.seasons.filter((s) => s.season_number === 0) ?? [];
  const totalEpisodes = regularSeasons.reduce(
    (sum, s) => sum + s.episode_count,
    0
  );
  const totalWatched = regularSeasons.reduce(
    (sum, s) => sum + Math.min(seasonCounts.get(s.season_number) ?? 0, s.episode_count),
    0
  );

  function toggle(status: LibraryStatus) {
    if (!show) return;
    if (item?.status === status) {
      removeItem.mutate({ tmdb_id: showId, media_type: "tv" });
    } else {
      setStatus.mutate({
        tmdb_id: showId,
        media_type: "tv",
        status,
        title: show.name,
        poster_path: show.poster_path,
        release_date: show.first_air_date || null,
      });
    }
  }

  /** Tapping "Completed" marks every episode watched — confirm first. */
  function handleStatusClick(status: LibraryStatus) {
    if (status === "completed" && item?.status !== "completed") {
      setConfirmCompletedOpen(true);
      return;
    }
    toggle(status);
  }

  async function confirmMarkCompleted() {
    if (!show) return;
    await Promise.all(
      regularSeasons.map((s) =>
        markSeason.mutateAsync({
          tmdb_show_id: showId,
          season_number: s.season_number,
          episode_numbers: Array.from(
            { length: s.episode_count },
            (_, i) => i + 1
          ),
          watched: true,
        })
      )
    );
    setStatus.mutate({
      tmdb_id: showId,
      media_type: "tv",
      status: "completed",
      title: show.name,
      poster_path: show.poster_path,
      release_date: show.first_air_date || null,
    });
    setConfirmCompletedOpen(false);
  }

  function confirmRemove() {
    removeItem.mutate({ tmdb_id: showId, media_type: "tv" });
    setConfirmRemoveOpen(false);
  }

  return (
    <>
      <Topbar title={show?.name ?? ""} back />
      <main className="content flex flex-col gap-6 pt-2">
        {isLoading && <Skeleton className="h-44 w-full" />}
        {error && (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        )}

        {show && (
          <>
            <DetailHeader
              title={show.name}
              posterPath={show.poster_path}
              lines={[
                [
                  show.first_air_date?.slice(0, 4),
                  show.status,
                  `${show.number_of_seasons} season${show.number_of_seasons === 1 ? "" : "s"}`,
                ]
                  .filter(Boolean)
                  .join(" · "),
                show.genres.map((g) => g.name).join(", "),
              ]}
            />

            {/* status chips — tocar de novo remove da lista. "Watching" é automático. */}
            <div className="grid grid-cols-3 gap-2">
              {MANUAL_TV_STATUSES.map((status) => (
                <button
                  key={status}
                  disabled={busy}
                  onClick={() => handleStatusClick(status)}
                  className={`h-10 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 ${
                    item?.status === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>

            {item?.status === "watching" && (
              <p className="-mt-3 text-center text-xs font-semibold text-primary">
                Watching — updates automatically as you mark episodes
              </p>
            )}

            {item && (
              <button
                onClick={() => setConfirmRemoveOpen(true)}
                disabled={busy}
                className="-mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground disabled:opacity-60"
              >
                <Trash2 size={13} /> Remove from list
              </button>
            )}

            {/* progresso geral */}
            {totalEpisodes > 0 && (
              <div className="rounded-xl bg-card p-3.5">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-bold">Progress</span>
                  <span className="text-xs text-muted-foreground">
                    {totalWatched}/{totalEpisodes} episodes
                  </span>
                </div>
                <ProgressBar
                  value={totalWatched}
                  max={totalEpisodes}
                  color={barColor}
                />
              </div>
            )}

            {/* próximo episódio a ir ao ar */}
            {show.next_episode_to_air && (
              <div className="flex items-center gap-3 rounded-xl bg-card p-3.5">
                <CalendarClock size={18} className="shrink-0 text-primary" />
                <p className="text-sm">
                  <span className="font-bold">
                    {seasonEpisodeLabel(
                      show.next_episode_to_air.season_number,
                      show.next_episode_to_air.episode_number
                    )}
                  </span>{" "}
                  airs {fmtDate(show.next_episode_to_air.air_date)}
                </p>
              </div>
            )}

            {/* temporadas */}
            <section>
              <h2 className="mb-3 text-base font-bold">Seasons</h2>
              <div className="flex flex-col gap-2">
                {[...regularSeasons, ...specials].map((season) => {
                  const seen = Math.min(
                    seasonCounts.get(season.season_number) ?? 0,
                    season.episode_count
                  );
                  return (
                    <Link
                      key={season.id}
                      href={`/tv/${showId}/season/${season.season_number}`}
                      className="flex items-center gap-3 rounded-xl bg-card p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{season.name}</p>
                        <p className="mb-1.5 text-xs text-muted-foreground">
                          {seen}/{season.episode_count} watched
                        </p>
                        <ProgressBar
                          value={seen}
                          max={season.episode_count}
                          color={barColor}
                        />
                      </div>
                      <ChevronRight
                        size={18}
                        className="shrink-0 text-muted-foreground"
                      />
                    </Link>
                  );
                })}
              </div>
            </section>

            {show.overview && (
              <section>
                <h2 className="mb-2 text-base font-bold">Synopsis</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {show.overview}
                </p>
              </section>
            )}

            <CastRow cast={show.credits?.cast ?? []} />

            <Dialog
              open={confirmCompletedOpen}
              onOpenChange={setConfirmCompletedOpen}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark all episodes watched?</DialogTitle>
                  <DialogDescription>
                    This marks every episode of {show.name} as watched and
                    moves it to Completed.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmCompletedOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={confirmMarkCompleted} disabled={busy}>
                    Mark all watched
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove from My List?</DialogTitle>
                  <DialogDescription>
                    {show.name} will be removed from your list. Your watched
                    episodes stay recorded, in case you add it back later.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmRemoveOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={confirmRemove}>
                    Remove
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </main>
    </>
  );
}
