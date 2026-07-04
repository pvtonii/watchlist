"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { Tv, Search } from "lucide-react";
import Topbar from "@/components/topbar";
import PosterCard from "@/components/poster-card";
import ProgressBar from "@/components/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLibrary,
  useWatchedEpisodes,
  useTmdb,
  useTvDetailsMany,
  watchedCountByShow,
} from "@/lib/hooks";
import { APP_NAME, tmdbPoster } from "@/lib/config";
import { fmtDateShort, seasonEpisodeLabel } from "@/lib/format";
import type { TvDetails, UpcomingResponse } from "@/lib/tmdb-types";
import { itemTitle, itemYear } from "@/lib/tmdb-types";

/** Regular (non-specials) episode total for a show. */
function regularTotal(show: TvDetails) {
  return show.seasons
    .filter((s) => s.season_number > 0)
    .reduce((sum, s) => sum + s.episode_count, 0);
}

/** Approximate next unwatched episode assuming episodes are watched in order. */
function nextUnwatched(show: TvDetails, seen: number) {
  let remaining = seen;
  const seasons = show.seasons
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);
  for (const s of seasons) {
    if (remaining < s.episode_count) {
      return { season: s.season_number, episode: remaining + 1 };
    }
    remaining -= s.episode_count;
  }
  return null;
}

export default function HomePage() {
  const { data: library, isLoading: libraryLoading } = useLibrary();
  const { data: watched } = useWatchedEpisodes();
  const { data: upcoming, isLoading: upcomingLoading } =
    useTmdb<UpcomingResponse>("/upcoming");

  const watchingShows = useMemo(
    () =>
      (library ?? []).filter(
        (i) => i.media_type === "tv" && i.status === "watching"
      ),
    [library]
  );
  const detailQueries = useTvDetailsMany(watchingShows.map((i) => i.tmdb_id));
  const counts = watchedCountByShow(watched);

  const shows = detailQueries
    .map((q) => q.data)
    .filter((s): s is TvDetails => Boolean(s));

  const upNext = shows
    .map((show) => {
      const total = regularTotal(show);
      const seen = counts.get(show.id) ?? 0;
      const next = seen < total ? nextUnwatched(show, seen) : null;
      return next ? { show, seen, total, next } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const airingSoon = shows
    .filter((s) => s.next_episode_to_air)
    .sort((a, b) =>
      (a.next_episode_to_air!.air_date ?? "").localeCompare(
        b.next_episode_to_air!.air_date ?? ""
      )
    );

  return (
    <>
      <Topbar title={APP_NAME} brand />
      <main className="content flex flex-col gap-7 pt-2">
        {/* -------- Up Next (continue watching) -------- */}
        <section>
          <h2 className="mb-3 text-base font-bold">Up Next</h2>
          {libraryLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : upNext.length === 0 ? (
            <div className="rounded-xl bg-card p-4 text-sm text-muted-foreground">
              <Tv className="mb-2 text-primary" size={20} />
              Nothing in progress. Find a show and set it to{" "}
              <span className="font-semibold text-foreground">Watching</span>{" "}
              to track episodes here.
              <Link
                href="/search"
                className="mt-3 flex items-center gap-1.5 font-semibold text-primary"
              >
                <Search size={14} /> Search shows
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {upNext.map(({ show, seen, total, next }) => (
                <Link
                  key={show.id}
                  href={`/tv/${show.id}/season/${next.season}`}
                  className="flex items-center gap-3 rounded-xl bg-card p-2.5"
                >
                  <ShowPoster path={show.poster_path} alt={show.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{show.name}</p>
                    <p className="mb-1.5 text-xs text-muted-foreground">
                      {seasonEpisodeLabel(next.season, next.episode)} up next
                    </p>
                    <ProgressBar value={seen} max={total} />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {seen}/{total} episodes
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* -------- Upcoming episodes of shows you watch -------- */}
        {airingSoon.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-bold">Upcoming Episodes</h2>
            <div className="flex flex-col gap-2.5">
              {airingSoon.map((show) => {
                const ep = show.next_episode_to_air!;
                return (
                  <Link
                    key={show.id}
                    href={`/tv/${show.id}`}
                    className="flex items-center gap-3 rounded-xl bg-card p-2.5"
                  >
                    <ShowPoster path={show.poster_path} alt={show.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {show.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {seasonEpisodeLabel(ep.season_number, ep.episode_number)}
                        {ep.name ? ` · ${ep.name}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">
                      {fmtDateShort(ep.air_date)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* -------- Upcoming movie releases (TMDB, real time) -------- */}
        <section>
          <h2 className="mb-3 text-base font-bold">Upcoming Movies</h2>
          {upcomingLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="hscroll">
              {(upcoming?.movies ?? []).slice(0, 15).map((m) => (
                <PosterCard
                  key={m.id}
                  id={m.id}
                  mediaType="movie"
                  title={itemTitle(m)}
                  posterPath={m.poster_path}
                  sub={fmtDateShort(m.release_date)}
                  width={108}
                />
              ))}
            </div>
          )}
        </section>

        {/* -------- TV airing this week -------- */}
        <section>
          <h2 className="mb-3 text-base font-bold">On TV This Week</h2>
          {upcomingLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="hscroll">
              {(upcoming?.tv ?? []).slice(0, 15).map((s) => (
                <PosterCard
                  key={s.id}
                  id={s.id}
                  mediaType="tv"
                  title={itemTitle(s)}
                  posterPath={s.poster_path}
                  sub={itemYear(s)}
                  width={108}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function ShowPoster({ path, alt }: { path: string | null; alt: string }) {
  const poster = tmdbPoster(path, "w185");
  return (
    <div className="relative h-[72px] w-12 shrink-0 overflow-hidden rounded-md bg-secondary">
      {poster && (
        <Image src={poster} alt={alt} fill sizes="48px" className="object-cover" />
      )}
    </div>
  );
}
