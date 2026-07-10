"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Tv, Search } from "lucide-react";
import Topbar from "@/components/topbar";
import PosterCard from "@/components/poster-card";
import ShowProgressCard from "@/components/show-progress-card";
import AppSplash from "@/components/app-splash";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLibrary,
  useWatchedEpisodes,
  useTmdb,
  useTvDetailsMany,
  watchedCountByShow,
  lastWatchedByShow,
} from "@/lib/hooks";
import {
  APP_NAME,
  regularEpisodeTotal,
  showProgressColor,
  tmdbPoster,
} from "@/lib/config";
import { fmtDate, fmtDateShort, seasonEpisodeLabel } from "@/lib/format";
import type { TvDetails, UpcomingMoviesResponse } from "@/lib/tmdb-types";
import { itemTitle } from "@/lib/tmdb-types";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // "haven't seen in a while" threshold
const POSTER_GRID = "grid grid-cols-4 gap-x-2.5 gap-y-5";

const HOME_TABS = ["tv", "movie"] as const;
type HomeTab = (typeof HOME_TABS)[number];
const HOME_TAB_LABELS: Record<HomeTab, string> = {
  tv: "TV Shows",
  movie: "Movies",
};

/** Reads UI state from the URL so it survives navigating into a detail page
 * and back — plain useState resets on remount, which made the back button
 * seem to "forget" which tab you were on. */
function readTab(params: URLSearchParams): HomeTab {
  const value = params.get("tab");
  return (HOME_TABS as readonly string[]).includes(value ?? "")
    ? (value as HomeTab)
    : "tv";
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

interface UpcomingMovieItem {
  id: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | undefined;
}

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTabState] = useState<HomeTab>(() => readTab(searchParams));

  function setTab(next: HomeTab) {
    setTabState(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    // replace, not push: switching tabs shouldn't stack in history, or the
    // back button from a detail page would unwind through old tab switches
    // instead of landing on the tab you actually drilled in from.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const { data: library, isLoading: libraryLoading } = useLibrary();
  const { data: watched } = useWatchedEpisodes();
  const { data: upcomingFeed, isLoading: upcomingFeedLoading } =
    useTmdb<UpcomingMoviesResponse>("/upcoming");

  const watchingShows = useMemo(
    () =>
      (library ?? []).filter(
        (i) => i.media_type === "tv" && i.status === "watching"
      ),
    [library]
  );
  /**
   * Watching + Want to Watch + Completed: any show whose new episodes are
   * worth surfacing. Completed is included so a show you're caught up on
   * still shows its next confirmed episode here — since there's no
   * background job flipping it back to "watching" the moment a new episode
   * airs, this is how you notice there's something new without having to
   * open the show.
   */
  const trackedTvShows = useMemo(
    () =>
      (library ?? []).filter(
        (i) =>
          i.media_type === "tv" &&
          (i.status === "watching" ||
            i.status === "watchlist" ||
            i.status === "completed")
      ),
    [library]
  );
  const detailQueries = useTvDetailsMany(trackedTvShows.map((i) => i.tmdb_id));
  const counts = watchedCountByShow(watched);
  const lastWatched = lastWatchedByShow(watched);

  const shows = detailQueries
    .map((q) => q.data)
    .filter((s): s is TvDetails => Boolean(s));
  const watchingShowIds = new Set(watchingShows.map((i) => i.tmdb_id));

  const upNextAll = shows
    .filter((show) => watchingShowIds.has(show.id))
    .map((show) => {
      const total = regularEpisodeTotal(show);
      const seen = counts.get(show.id) ?? 0;
      const next = seen < total ? nextUnwatched(show, seen) : null;
      const lastWatchedAt = lastWatched.get(show.id) ?? null;
      return next ? { show, seen, total, next, lastWatchedAt } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // recently active first; shows you haven't touched in 30+ days split off
  // into their own "stale" section. Shows you've never actually started
  // (no watched_at at all) are left out of Home entirely — they're not
  // "haven't seen in a while", they're "haven't seen at all".
  const now = new Date().getTime();
  const upNextRecent = upNextAll
    .filter(
      (x) => x.lastWatchedAt && now - new Date(x.lastWatchedAt).getTime() <= STALE_AFTER_MS
    )
    .sort((a, b) => b.lastWatchedAt!.localeCompare(a.lastWatchedAt!));
  const upNextStale = upNextAll
    .filter(
      (x) => x.lastWatchedAt && now - new Date(x.lastWatchedAt).getTime() > STALE_AFTER_MS
    )
    .sort((a, b) => b.lastWatchedAt!.localeCompare(a.lastWatchedAt!));

  const airingSoon = shows
    .filter((s) => s.next_episode_to_air)
    .sort((a, b) =>
      (a.next_episode_to_air!.air_date ?? "").localeCompare(
        b.next_episode_to_air!.air_date ?? ""
      )
    );

  const wantToWatchMovies = (library ?? []).filter(
    (i) => i.media_type === "movie" && i.status === "watchlist"
  );

  const movieStatusById = useMemo(() => {
    const map = new Map<number, "watchlist" | "completed">();
    for (const i of library ?? []) {
      if (
        i.media_type === "movie" &&
        (i.status === "watchlist" || i.status === "completed")
      ) {
        map.set(i.tmdb_id, i.status);
      }
    }
    return map;
  }, [library]);

  // Want-to-watch movies that haven't released yet, in case they're missing
  // from TMDB's own /movie/upcoming page (pagination, region quirks, etc).
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingWantToWatchMovies = wantToWatchMovies.filter(
    (m) => m.release_date && m.release_date >= todayIso
  );

  // TMDB's discovery feed + your own upcoming Want to Watch movies, merged
  // and de-duped by id, sorted soonest-first.
  const upcomingMoviesById = new Map<number, UpcomingMovieItem>();
  for (const m of upcomingFeed?.movies ?? []) {
    upcomingMoviesById.set(m.id, {
      id: m.id,
      title: itemTitle(m),
      posterPath: m.poster_path,
      releaseDate: m.release_date,
    });
  }
  for (const m of upcomingWantToWatchMovies) {
    if (!upcomingMoviesById.has(m.tmdb_id)) {
      upcomingMoviesById.set(m.tmdb_id, {
        id: m.tmdb_id,
        title: m.title,
        posterPath: m.poster_path,
        releaseDate: m.release_date ?? undefined,
      });
    }
  }
  const combinedUpcomingMovies = Array.from(upcomingMoviesById.values()).sort(
    (a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "")
  );

  // One full-screen splash while the core data loads, instead of every
  // section popping in its own skeleton at a different time.
  if (libraryLoading) return <AppSplash />;

  return (
    <>
      <Topbar title={APP_NAME} brand />
      <main className="content flex flex-col gap-7 pt-2">
        {/* -------- TV Shows / Movies tabs -------- */}
        <div className="grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
          {HOME_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full py-1.5 text-xs font-bold transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {HOME_TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === "tv" && (
          <>
            {/* -------- Up Next (continue watching, recently active) -------- */}
            <section>
              <h2 className="mb-3 text-base font-bold">Up Next</h2>
              {upNextAll.length === 0 ? (
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
              ) : upNextRecent.length === 0 && upNextStale.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing watched yet — mark an episode to see it here.
                </p>
              ) : upNextRecent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing watched recently — check “Haven&apos;t Seen in a While” below.
                </p>
              ) : (
                <div className={POSTER_GRID}>
                  {upNextRecent.map(({ show, seen, total, next }) => (
                    <ShowProgressCard
                      key={show.id}
                      href={`/tv/${show.id}`}
                      title={show.name}
                      posterPath={show.poster_path}
                      seen={seen}
                      total={total}
                      nextLabel={`${seasonEpisodeLabel(next.season, next.episode)} up next`}
                      color={showProgressColor("watching", show.status)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* -------- Watching shows you haven't touched in 30+ days -------- */}
            {upNextStale.length > 0 && (
              <section>
                <h2 className="mb-3 text-base font-bold">Haven&apos;t Seen in a While</h2>
                <div className={POSTER_GRID}>
                  {upNextStale.map(({ show, seen, total }) => (
                    <ShowProgressCard
                      key={show.id}
                      href={`/tv/${show.id}`}
                      title={show.name}
                      posterPath={show.poster_path}
                      seen={seen}
                      total={total}
                      compact
                      color={showProgressColor("watching", show.status)}
                    />
                  ))}
                </div>
              </section>
            )}

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
          </>
        )}

        {tab === "movie" && (
          <>
            {/* -------- Movies you've marked Want to Watch -------- */}
            <section>
              <h2 className="mb-3 text-base font-bold">Want to Watch</h2>
              {wantToWatchMovies.length === 0 ? (
                <div className="rounded-xl bg-card p-4 text-sm text-muted-foreground">
                  Nothing marked Want to Watch yet.
                  <Link
                    href="/search"
                    className="mt-3 flex items-center gap-1.5 font-semibold text-primary"
                  >
                    <Search size={14} /> Search movies
                  </Link>
                </div>
              ) : (
                <div className={POSTER_GRID}>
                  {wantToWatchMovies.map((item) => (
                    <PosterCard
                      key={item.id}
                      id={item.tmdb_id}
                      mediaType="movie"
                      title={item.title}
                      posterPath={item.poster_path}
                      sub={fmtDate(item.release_date)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* -------- Upcoming releases: TMDB feed + your own Want to Watch -------- */}
            <section>
              <h2 className="mb-3 text-base font-bold">Upcoming Movies</h2>
              {upcomingFeedLoading ? (
                <div className={POSTER_GRID}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
                  ))}
                </div>
              ) : combinedUpcomingMovies.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No upcoming releases right now.
                </p>
              ) : (
                <div className={POSTER_GRID}>
                  {combinedUpcomingMovies.map((m) => (
                    <PosterCard
                      key={m.id}
                      id={m.id}
                      mediaType="movie"
                      title={m.title}
                      posterPath={m.posterPath}
                      sub={fmtDate(m.releaseDate)}
                      statusBadge={movieStatusById.get(m.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
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
