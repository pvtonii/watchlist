"use client";

import { use } from "react";
import { Bookmark, Check } from "lucide-react";
import Topbar from "@/components/topbar";
import DetailHeader from "@/components/detail-header";
import CastRow from "@/components/cast-row";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLibrary,
  useSetStatus,
  useRemoveFromLibrary,
  useTmdb,
} from "@/lib/hooks";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { MovieDetails } from "@/lib/tmdb-types";
import { movieAvailability, type LibraryStatus } from "@/lib/config";

export default function MoviePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const movieId = Number(id);

  const { data: movie, isLoading, error } = useTmdb<MovieDetails>(`/movie/${id}`);
  const { data: library } = useLibrary();
  const setStatus = useSetStatus();
  const removeItem = useRemoveFromLibrary();

  const item = library?.find(
    (i) => i.tmdb_id === movieId && i.media_type === "movie"
  );
  const busy = setStatus.isPending || removeItem.isPending;

  function toggle(status: LibraryStatus) {
    if (!movie) return;
    if (item?.status === status) {
      removeItem.mutate({ tmdb_id: movieId, media_type: "movie" });
    } else {
      setStatus.mutate({
        tmdb_id: movieId,
        media_type: "movie",
        status,
        title: movie.title,
        poster_path: movie.poster_path,
        release_date: movie.release_date || null,
      });
    }
  }

  return (
    <>
      <Topbar title={movie?.title ?? ""} back />
      <main className="content flex flex-col gap-6 pt-2">
        {isLoading && <Skeleton className="h-44 w-full" />}
        {error && (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        )}

        {movie && (
          <>
            <DetailHeader
              title={movie.title}
              posterPath={movie.poster_path}
              lines={[
                fmtDate(movie.release_date),
                [
                  movie.runtime ? `${movie.runtime} min` : null,
                  movie.genres.map((g) => g.name).join(", ") || null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              ]}
            />

            {(() => {
              const availability = movieAvailability(movie);
              return availability.kind !== "unknown" ? (
                <span className="-mt-3 self-center rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">
                  {availability.label}
                </span>
              ) : null;
            })()}

            {/* actions: tocar de novo remove da lista */}
            <div className="grid grid-cols-2 gap-3">
              <ActionButton
                active={item?.status === "watchlist"}
                disabled={busy}
                onClick={() => toggle("watchlist")}
                icon={<Bookmark size={16} />}
                label="Want to Watch"
              />
              <ActionButton
                active={item?.status === "completed"}
                disabled={busy}
                onClick={() => toggle("completed")}
                icon={<Check size={16} />}
                label="Watched"
              />
            </div>

            {item?.status === "completed" && (
              <p className="-mt-3 text-center text-xs text-muted-foreground">
                Watched {fmtDateTime(item.updated_at)}
              </p>
            )}

            {movie.overview && (
              <section>
                <h2 className="mb-2 text-base font-bold">Synopsis</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {movie.overview}
                </p>
              </section>
            )}

            <CastRow cast={movie.credits?.cast ?? []} />
          </>
        )}
      </main>
    </>
  );
}

function ActionButton({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
