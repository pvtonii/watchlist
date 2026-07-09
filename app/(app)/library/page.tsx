"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Film, Clapperboard, SearchX, X } from "lucide-react";
import Topbar from "@/components/topbar";
import ProgressBar from "@/components/progress-bar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLibrary,
  useWatchedEpisodes,
  useTvDetailsMany,
  useMovieDetailsMany,
  watchedCountByShow,
  lastWatchedByShow,
  type LibraryItem,
} from "@/lib/hooks";
import {
  ENDED_TV_STATUSES,
  regularEpisodeTotal,
  showProgressColor,
  tmdbPoster,
} from "@/lib/config";
import { fmtDateTime, fmtMonthYear, fmtYearRange } from "@/lib/format";
import type { MovieDetails, TvDetails } from "@/lib/tmdb-types";

const MEDIA_TYPES = ["tv", "movie"] as const;
type MediaTypeFilter = (typeof MEDIA_TYPES)[number];
const MEDIA_TYPE_LABELS: Record<MediaTypeFilter, string> = {
  tv: "TV Shows",
  movie: "Movies",
};

// TV Time-style progress buckets, derived at display time (not stored):
// - haventStarted = status watchlist
// - watching       = status watching (TV only — movies have no partial state)
// - upToDate       = status completed, show still airing (not Ended/Canceled)
// - finished       = status completed, show has genuinely ended (or any movie)
// - stopped        = status dropped (TV only)
type ProgressFilter =
  | "all"
  | "watching"
  | "haventStarted"
  | "upToDate"
  | "finished"
  | "stopped";
const PROGRESS_LABELS: Record<ProgressFilter, string> = {
  all: "All",
  watching: "Watching",
  haventStarted: "Haven't Started",
  upToDate: "Up to Date",
  finished: "Finished",
  stopped: "Stopped",
};
const PROGRESS_OPTIONS_BY_MEDIA_TYPE: Record<MediaTypeFilter, readonly ProgressFilter[]> = {
  tv: ["all", "watching", "haventStarted", "upToDate", "finished", "stopped"],
  movie: ["all", "haventStarted", "finished"],
};
const DEFAULT_PROGRESS_BY_MEDIA_TYPE: Record<MediaTypeFilter, ProgressFilter> = {
  tv: "watching",
  movie: "haventStarted",
};

type SortOption = "lastWatched" | "lastAdded" | "releaseDate" | "alpha";
const SORT_LABELS: Record<SortOption, string> = {
  lastWatched: "Last Watched",
  lastAdded: "Last Added",
  releaseDate: "Release Date",
  alpha: "A-Z",
};
const SORT_OPTIONS: readonly SortOption[] = [
  "lastWatched",
  "lastAdded",
  "releaseDate",
  "alpha",
];
const DEFAULT_SORT: SortOption = "lastWatched";

// "Last Watched" is meaningless for "Haven't Started" — nothing there has
// ever been watched, so the whole list would just fall back to A-Z anyway.
function sortOptionsFor(progress: ProgressFilter): readonly SortOption[] {
  return progress === "haventStarted"
    ? SORT_OPTIONS.filter((o) => o !== "lastWatched")
    : SORT_OPTIONS;
}
function defaultSortFor(progress: ProgressFilter): SortOption {
  return progress === "haventStarted" ? "lastAdded" : DEFAULT_SORT;
}

// Reads UI state (tab/media/sort) from the URL so it survives navigating
// into a detail page and back — plain useState resets on remount, which made
// the back button seem to "forget" what you had selected.
function readMediaType(params: URLSearchParams): MediaTypeFilter {
  const value = params.get("media");
  return (MEDIA_TYPES as readonly string[]).includes(value ?? "")
    ? (value as MediaTypeFilter)
    : "tv";
}
function readProgress(params: URLSearchParams, mediaType: MediaTypeFilter): ProgressFilter {
  const value = params.get("progress");
  return PROGRESS_OPTIONS_BY_MEDIA_TYPE[mediaType].includes(value as ProgressFilter)
    ? (value as ProgressFilter)
    : DEFAULT_PROGRESS_BY_MEDIA_TYPE[mediaType];
}
function readSort(params: URLSearchParams, progress: ProgressFilter): SortOption {
  const value = params.get("sort");
  const options = sortOptionsFor(progress);
  return (options as readonly string[]).includes(value ?? "")
    ? (value as SortOption)
    : defaultSortFor(progress);
}

/** TV Time-style progress bucket for a library item (display-only, never persisted). */
function progressCategory(
  item: LibraryItem,
  details: TvDetails | undefined
): ProgressFilter {
  if (item.media_type === "movie") {
    return item.status === "watchlist" ? "haventStarted" : "finished";
  }
  if (item.status === "watchlist") return "haventStarted";
  if (item.status === "dropped") return "stopped";
  if (item.status === "watching") return "watching";
  // completed
  const ended = details ? ENDED_TV_STATUSES.includes(details.status) : false;
  return ended ? "finished" : "upToDate";
}

export default function LibraryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mediaType, setMediaTypeState] = useState<MediaTypeFilter>(() =>
    readMediaType(searchParams)
  );
  const [progress, setProgressState] = useState<ProgressFilter>(() =>
    readProgress(searchParams, mediaType)
  );
  const [sortBy, setSortByState] = useState<SortOption>(() =>
    readSort(searchParams, readProgress(searchParams, mediaType))
  );
  const [searchText, setSearchText] = useState("");
  const { data: library, isLoading } = useLibrary();
  const { data: watched } = useWatchedEpisodes();

  const progressOptions = PROGRESS_OPTIONS_BY_MEDIA_TYPE[mediaType];
  const sortOptions = sortOptionsFor(progress);

  // Mirror state into the URL (replace, not push — this is a filter tweak,
  // not a new "place" to visit) so it's whatever's there when you come back.
  function updateQuery(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Switching progress can make the current sort unavailable (e.g. leaving
  // "Last Watched" selected when moving into "Haven't Started") — fall back
  // to a sensible default instead of leaving an invalid sort selected.
  function applyProgress(next: ProgressFilter, patch: Record<string, string>) {
    setProgressState(next);
    if (!sortOptionsFor(next).includes(sortBy)) {
      const fallback = defaultSortFor(next);
      setSortByState(fallback);
      patch.sort = fallback;
    }
    updateQuery(patch);
  }

  function setProgress(next: ProgressFilter) {
    applyProgress(next, { progress: next });
  }

  function setSortBy(next: SortOption) {
    setSortByState(next);
    updateQuery({ sort: next });
  }

  function selectMediaType(type: MediaTypeFilter) {
    const nextProgress = DEFAULT_PROGRESS_BY_MEDIA_TYPE[type];
    setMediaTypeState(type);
    applyProgress(nextProgress, { media: type, progress: nextProgress });
  }

  function clearSearch() {
    setSearchText("");
  }

  const mediaItems = useMemo(
    () => (library ?? []).filter((i) => i.media_type === mediaType),
    [library, mediaType]
  );

  const tvIds = mediaType === "tv" ? mediaItems.map((i) => i.tmdb_id) : [];
  const movieIds = mediaType === "movie" ? mediaItems.map((i) => i.tmdb_id) : [];
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
  const lastWatched = lastWatchedByShow(watched);

  const categorized = useMemo(
    () =>
      mediaItems.map((item) => ({
        item,
        category: progressCategory(item, detailsById.get(item.tmdb_id)),
      })),
    [mediaItems, detailsById]
  );

  const progressCounts = useMemo(() => {
    const map: Record<ProgressFilter, number> = {
      all: 0,
      watching: 0,
      haventStarted: 0,
      upToDate: 0,
      finished: 0,
      stopped: 0,
    };
    for (const { category } of categorized) {
      map.all += 1;
      map[category] += 1;
    }
    return map;
  }, [categorized]);

  const filteredItems = useMemo(
    () =>
      categorized
        .filter((x) => progress === "all" || x.category === progress)
        .map((x) => x.item),
    [categorized, progress]
  );

  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    if (sortBy === "alpha") {
      arr.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "lastAdded") {
      arr.sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || a.title.localeCompare(b.title)
      );
    } else if (sortBy === "releaseDate") {
      // Most recently released first. Nothing dated (shouldn't happen, but
      // defensively) sorts last.
      arr.sort((a, b) => {
        const dateA = a.release_date;
        const dateB = b.release_date;
        if (!dateA && dateB) return 1;
        if (dateA && !dateB) return -1;
        if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
        return a.title.localeCompare(b.title);
      });
    } else {
      // lastWatched: TV uses the most recent episode watched_at; movies use
      // when they were marked completed. Nothing watched yet sorts last.
      arr.sort((a, b) => {
        const dateA =
          a.media_type === "tv"
            ? (lastWatched.get(a.tmdb_id) ?? null)
            : a.status === "completed"
              ? a.updated_at
              : null;
        const dateB =
          b.media_type === "tv"
            ? (lastWatched.get(b.tmdb_id) ?? null)
            : b.status === "completed"
              ? b.updated_at
              : null;
        if (!dateA && dateB) return 1;
        if (dateA && !dateB) return -1;
        if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
        return a.title.localeCompare(b.title);
      });
    }
    return arr;
  }, [filteredItems, sortBy, lastWatched]);

  const searchedItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return q ? sortedItems.filter((i) => i.title.toLowerCase().includes(q)) : sortedItems;
  }, [sortedItems, searchText]);

  return (
    <>
      <Topbar
        title="My List"
        right={
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {PROGRESS_LABELS[progress]} {progressCounts[progress]}
          </span>
        }
      />
      <main className="content pt-1">
        {/* search, same field as the Search screen */}
        <div className="relative mb-3">
          <Input
            type="search"
            placeholder="Search your list…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-11 pr-9"
          />
          {searchText.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
          )}
        </div>

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

        {/* progress */}
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {progressOptions.map((option) => (
            <button
              key={option}
              onClick={() => setProgress(option)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                progress === option
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {PROGRESS_LABELS[option]}
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

        {!isLoading && searchText.trim().length > 0 && searchedItems.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-2 text-muted-foreground">
            <SearchX size={28} />
            <p className="text-sm">No results for “{searchText.trim()}”</p>
          </div>
        )}

        {!isLoading && searchText.trim().length === 0 && sortedItems.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-2 text-muted-foreground">
            <Clapperboard size={28} />
            <p className="text-sm">
              Nothing in “{PROGRESS_LABELS[progress]}” for {MEDIA_TYPE_LABELS[mediaType]}{" "}
              yet.
            </p>
            <Link href="/search" className="text-sm font-bold text-primary">
              Find something to watch
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {searchedItems.map((item) => {
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
