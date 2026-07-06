"use client";

import Image from "next/image";
import Link from "next/link";
import { Film, Check, Star } from "lucide-react";
import { tmdbPoster } from "@/lib/config";
import type { MediaType } from "@/lib/tmdb-types";

export default function PosterCard({
  id,
  mediaType,
  title,
  posterPath,
  sub,
  width,
  inLibrary,
  rating,
}: {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  sub?: string;
  /** Fixed width for horizontal rows; omit for fluid width in grids. */
  width?: number;
  /** Shows a checkmark badge — already in the user's library. */
  inLibrary?: boolean;
  /** TMDB vote_average (0-10) — shown as a community rating badge. */
  rating?: number;
}) {
  const poster = tmdbPoster(posterPath);

  return (
    <Link
      href={`/${mediaType}/${id}`}
      className="block shrink-0"
      style={width ? { width } : undefined}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-secondary">
        {poster ? (
          <Image
            src={poster}
            alt={title}
            fill
            sizes={width ? `${width}px` : "33vw"}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Film size={28} />
          </div>
        )}
        {inLibrary && (
          <div
            title="In your list"
            className="absolute right-1.5 top-1.5 rounded-full bg-primary p-1 text-primary-foreground shadow"
          >
            <Check size={12} strokeWidth={3} />
          </div>
        )}
        {typeof rating === "number" && rating > 0 && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-white shadow">
            <Star size={10} className="fill-yellow-400 text-yellow-400" />
            <span className="text-[10px] font-bold leading-none">
              {rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs leading-tight font-semibold">
        {title}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </Link>
  );
}
