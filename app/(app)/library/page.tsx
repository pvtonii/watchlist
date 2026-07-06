"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Film, Clapperboard } from "lucide-react";
import Topbar from "@/components/topbar";
import ProgressBar from "@/components/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLibrary,
  useWatchedEpisodes,
  useTvDetailsMany,
  watchedCountByShow,
} from "@/lib/hooks";
import {
  LIBRARY_STATUSES,
  STATUS_LABELS,
  tmdbPoster,
  type LibraryStatus,
} from "@/lib/config";
import type { TvDetails } from "@/lib/tmdb-types";

const MEDIA_TYPES = ["tv", "movie"] as const;
type MediaTypeFilter = (typeof MEDIA_TYPES)[number];
const MEDIA_TYPE_LABELS: Record<MediaTypeFilter, string> = {
  tv: "TV Shows",
  movie: "Movies",
};

export default function LibraryPage() {
  const [tab, setTab] = useState<LibraryStatus>("watching");
  const [mediaType, setMediaType] = useState<MediaTypeFilter>("tv");
  const { data: library, isLoading } = useLibrary();
  const { data: watched } = useWatchedEpisodes();

  const items = useMemo(
    () =>
      (library ?? []).filter(
        (i) => i.status === tab && i.media_type === mediaType
      ),
    [library, tab, mediaType]
  );
  const tvIds = items
    .filter((i) => i.media_type === "tv")
    .map((i) => i.tmdb_id);
  const detailQueries = useTvDetailsMany(tvIds);
  const detailsById = new Map<number, TvDetails>();
  for (const q of detailQueries) {
    if (q.data) detailsById.set(q.data.id, q.data);
  }
  const counts = watchedCountByShow(watched);

  return (
    <>
      <Topbar title="My List" />
      <main className="content pt-1">
        {/* toggle TV Shows / Movies */}
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
          {MEDIA_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setMediaType(type)}
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
          {LIBRARY_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => setTab(status)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                tab === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        {isLoading && <Skeleton className="h-40 w-full" />}

        {!isLoading && items.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-2 text-muted-foreground">
            <Clapperboard size={28} />
            <p className="text-sm">
              Nothing in “{STATUS_LABELS[tab]}” for {MEDIA_TYPE_LABELS[mediaType]} yet.
            </p>
            <Link href="/search" className="text-sm font-bold text-primary">
              Find something to watch
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {items.map((item) => {
            const poster = tmdbPoster(item.poster_path, "w185");
            const details =
              item.media_type === "tv" ? detailsById.get(item.tmdb_id) : null;
            const total = details
              ? details.seasons
                  .filter((s) => s.season_number > 0)
                  .reduce((sum, s) => sum + s.episode_count, 0)
              : 0;
            const seen = counts.get(item.tmdb_id) ?? 0;

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
                    {item.media_type === "tv" ? "TV Show" : "Movie"}
                    {item.release_date
                      ? ` · ${item.release_date.slice(0, 4)}`
                      : ""}
                  </p>
                  {item.media_type === "tv" && total > 0 && (
                    <>
                      <div className="mt-1.5">
                        <ProgressBar value={Math.min(seen, total)} max={total} />
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
