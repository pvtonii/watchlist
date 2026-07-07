"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Film, Clapperboard } from "lucide-react";
import Topbar from "@/components/topbar";
import ProgressBar from "@/components/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLibrary,
  useWatchedEpisodes,
  useTvDetailsMany,
  useMovieDetailsMany,
  watchedCountByShow,
} from "@/lib/hooks";
import {
  ENDED_TV_STATUSES,
  LIBRARY_STATUSES,
  regularEpisodeTotal,
  releasedEpisodeCount,
  showProgressColor,
  STATUS_LABELS,
  tmdbPoster,
  type LibraryStatus,
} from "@/lib/config";
import { fmtDateTime, fmtMonthYear, fmtYearRange } from "@/lib/format";
import type { MovieDetails, TvDetails } from "@/lib/tmdb-types";

const MEDIA_TYPES = ["tv", "movie"] as const;
type MediaTypeFilter = (typeof MEDIA_TYPES)[number];
const MEDIA_TYPE_LABELS: Record<MediaTypeFilter, string> = {
  tv: "TV Shows",
  movie: "Movies",
};

// Movies only ever get "watchlist"/"completed" (see lib/config.ts); no per-episode "watching" or "dropped".
const MOVIE_STATUSES: readonly LibraryStatus[] = ["watchlist", "completed"];
type StatusFilter = LibraryStatus | "all";
const STATUSES_BY_MEDIA_TYPE: Record<MediaTypeFilter, readonly StatusFilter[]> = {
  tv: ["all", ...LIBRARY_STATUSES],
  movie: ["all", ...MOVIE_STATUSES],
};
const TAB_LABELS: Record<StatusFilter, string> = {
  all: "All",
  ...STATUS_LABELS,
};

// "New Ep" only makes sense for TV — movies have no per-episode progress or
// air schedule. "Release Date" only makes sense for movies — TV already has
// air-date-aware sorts. There's no "caught up" sort anymore: a TV show that's
// watched everything released so far now automatically lives in Completed
// (see deriveTvLibraryStatus / useSyncTvStatuses).
type SortOption = "alpha" | "airing" | "releaseDate";
const SORT_LABELS: Record<SortOption, string> = {
  alpha: "A-Z",
  airing: "New Ep",
  releaseDate: "Release Date",
};
const SORT_OPTIONS_BY_MEDIA_TYPE: Record<MediaTypeFilter, readonly SortOption[]> = {
  tv: ["alpha", "airing"],
  movie: ["releaseDate", "alpha"],
};
// Movies default to Release Date (most useful chronological view); TV to A-Z.
const DEFAULT_SORT_BY_MEDIA_TYPE: Record<MediaTypeFilter, SortOption> = {
  tv: "alpha",
  movie: "releaseDate",
};

// Reads UI state (tab/media/sort) from the URL so it survives navigating
// into a detail page and back — plain useState resets on remount, which made
// the back button seem to "forget" what you had selected.
function readMediaType(params: URLSearchParams): MediaTypeFilter {
  const value = params.get("media");
  return (MEDIA_TYPES as readonly string[]).includes(value ?? "")
    ? (value as MediaTypeFilter)
    : "tv";
}
function readTab(params: URLSearchParams, mediaType: MediaTypeFilter): StatusFilter {
  const value = params.get("tab");
  return STATUSES_BY_MEDIA_TYPE[mediaType].includes(value as StatusFilter)
    ? (value as StatusFilter)
    : "watching";
}
function readSort(params: URLSearchParams, mediaType: MediaTypeFilter): SortOption {
  const value = params.get("sort");
  return SORT_OPTIONS_BY_MEDIA_TYPE[mediaType].includes(value as SortOption)
    ? (value as SortOption)
    : DEFAULT_SORT_BY_MEDIA_TYPE[mediaType];
}

export default function LibraryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mediaType, setMediaTypeState] = useState<MediaTypeFilter>(() =>
    readMediaType(searchParams)
  );
  const [tab, setTabState] = useState<StatusFilter>(() =>
    readTab(searchParams, mediaType)
  );
  const [sortBy, setSortByState] = useState<SortOption>(() =>
    readSort(searchParams, mediaType)
  );
  const { data: library, isLoading } = useLibrary();
  const { data: watched } = useWatchedEpisodes();

  const statuses = STATUSES_BY_MEDIA_TYPE[mediaType];
  const sortOptions = SORT_OPTIONS_BY_MEDIA_TYPE[mediaType];

  // Mirror state into the URL (replace, not push — this is a filter tweak,
  // not a new "place" to visit) so it's whatever's there when you come back.
  function updateQuery(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setTab(next: StatusFilter) {
    setTabState(next);
    updateQuery({ tab: next });
  }

  function setSortBy(next: SortOption) {
    setSortByState(next);
    updateQuery({ sort: next });
  }

  function selectMediaType(type: MediaTypeFilter) {
    const nextTab = STATUSES_BY_MEDIA_TYPE[type].includes(tab) ? tab : "watchlist";
    const nextSort = DEFAULT_SORT_BY_MEDIA_TYPE[type];
    setMediaTypeState(type);
    setTabState(nextTab);
    setSortByState(nextSort);
    updateQuery({ media: type, tab: nextTab, sort: nextSort });
  }

  const items = useMemo(
    () =>
      (library ?? []).filter(
        (i) =>
          (tab === "all" || i.status === tab) && i.media_type === mediaType
      ),
    [library, tab, mediaType]
  );

  const countsByStatus = useMemo(() => {
    const map: Record<StatusFilter, number> = {
      all: 0,
      watchlist: 0,
      watching: 0,
      completed: 0,
      dropped: 0,
    };
    for (const i of library ?? []) {
      if (i.media_type !== mediaType) continue;
      map.all += 1;
      map[i.status] += 1;
    }
    return map;
  }, [library, mediaType]);
  const tvIds = items
    .filter((i) => i.media_type === "tv")
    .map((i) => i.tmdb_id);
  const movieIds = items
    .filter((i) => i.media_type === "movie")
    .map((i) => i.tmdb_id);
  const detailQueries = useTvDetailsMany(tvIds);
  const movieDetailQueries = useMovieDetailsMany(movieIds);
  const detailsById = useMemo(() => {
    const map = new Map<number, TvDetails>();
    for (const q of detailQueries) if (q.data) map.set(q.data.id, q.data);
    return map;
  }, [detailQueries]);
  const movieDetailsById = useMemo(() => {
    const map = new Map<number, MovieDetails>();
    for (const q of movieDetailQueries) if (q.data) map.set(q.data.id, q.data);
    return map;
  }, [movieDetailQueries]);
  const counts = watchedCountByShow(watched);

  const sortedItems = useMemo(() => {
    if (sortBy === "airing") {
      // Anything "new for you to watch": episodes already released that you
      // haven't seen yet, or a confirmed upcoming episode. Sorted by that
      // episode's release date, most recent first.
      const today = new Date().toISOString().slice(0, 10);
      return items
        .map((item) => {
          const details = detailsById.get(item.tmdb_id);
          const released = details ? releasedEpisodeCount(details) : 0;
          const seen = counts.get(item.tmdb_id) ?? 0;
          const behind = Boolean(details) && seen < released;
          const nextDate = details?.next_episode_to_air?.air_date ?? null;
          const hasUpcoming = Boolean(nextDate && nextDate >= today);
          const date = behind
            ? (details?.last_episode_to_air?.air_date ?? null)
            : hasUpcoming
              ? nextDate
              : null;
          return { item, date, include: behind || hasUpcoming };
        })
        .filter((x) => x.include && x.date)
        .sort(
          (a, b) =>
            b.date!.localeCompare(a.date!) || a.item.title.localeCompare(b.item.title)
        )
        .map((x) => x.item);
    }

    if (sortBy === "releaseDate") {
      const arr = [...items];
      if (tab === "completed") {
        // most recently watched movie first
        arr.sort(
          (a, b) =>
            b.updated_at.localeCompare(a.updated_at) || a.title.localeCompare(b.title)
        );
      } else {
        // newest release first; missing dates sort to the end
        arr.sort((a, b) => {
          if (!a.release_date && b.release_date) return 1;
          if (a.release_date && !b.release_date) return -1;
          if (a.release_date && b.release_date && a.release_date !== b.release_date) {
            return b.release_date.localeCompare(a.release_date);
          }
          return a.title.localeCompare(b.title);
        });
      }
      return arr;
    }

    return [...items].sort((a, b) => a.title.localeCompare(b.title));
  }, [items, tab, sortBy, detailsById, counts]);

  return (
    <>
      <Topbar
        title="My List"
        right={
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {TAB_LABELS[tab]} {countsByStatus[tab]}
          </span>
        }
      />
      <main className="content pt-1">
        {/* toggle TV Shows / Movies */}
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
          {MEDIA_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => selectMediaType(type)}
              className={`rounded-full py-1.5 text-xs font-bold transition-colors ${
                mediaType === type
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {MEDIA_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* tabs por status */}
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setTab(status)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                tab === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {TAB_LABELS[status]}
            </button>
          ))}
        </div>

        {/* sort */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-xs font-bold text-muted-foreground">Sort:</span>
          {sortOptions.map((option) => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                sortBy === option
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {SORT_LABELS[option]}
            </button>
          ))}
        </div>

        {isLoading && <Skeleton className="h-40 w-full" />}

        {!isLoading && sortedItems.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-2 text-muted-foreground">
            <Clapperboard size={28} />
            <p className="text-sm">
              {sortBy === "airing" && items.length > 0
                ? "Nothing new to watch in this list yet."
                : `Nothing in “${TAB_LABELS[tab]}” for ${MEDIA_TYPE_LABELS[mediaType]} yet.`}
            </p>
            <Link href="/search" className="text-sm font-bold text-primary">
              Find something to watch
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {sortedItems.map((item) => {
            const poster = tmdbPoster(item.poster_path, "w185");
            const details =
              item.media_type === "tv" ? detailsById.get(item.tmdb_id) : null;
            const movieDetails =
              item.media_type === "movie"
                ? movieDetailsById.get(item.tmdb_id)
                : null;
            const genre = (details ?? movieDetails)?.genres[0]?.name;
            const total = details ? regularEpisodeTotal(details) : 0;
            const seen = counts.get(item.tmdb_id) ?? 0;
            const ended = details
              ? ENDED_TV_STATUSES.includes(details.status)
              : false;
            const barColor =
              item.media_type === "tv"
                ? showProgressColor(item.status, details?.status)
                : undefined;
            const dateLabel = details
              ? fmtYearRange(
                  details.first_air_date,
                  ended,
                  details.last_episode_to_air?.air_date
                )
              : fmtMonthYear(item.release_date);

            return (
              <Link
                key={item.id}
                href={`/${item.media_type}/${item.tmdb_id}`}
                className="flex items-center gap-3 rounded-xl bg-card p-2.5"
              >
                <div className="relative h-[72px] w-12 shrink-0 overflow-hidden rounded-md bg-secondary">
                  {poster ? (
                    <Image
                      src={poster}
                      alt={item.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Film size={18} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[genre, dateLabel].filter(Boolean).join(" · ")}
                  </p>
                  {item.status === "completed" && (
                    <p className="text-[11px] text-primary">
                      Watched {fmtDateTime(item.updated_at)}
                    </p>
                  )}
                  {item.media_type === "tv" && total > 0 && (
                    <>
                      <div className="mt-1.5">
                        <ProgressBar
                          value={Math.min(seen, total)}
                          max={total}
                          color={barColor}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {Math.min(seen, total)}/{total} episodes
                      </p>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
